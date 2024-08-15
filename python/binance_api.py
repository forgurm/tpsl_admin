import requests
import time
import logging
from requests.exceptions import RequestException
from apscheduler.schedulers.background import BackgroundScheduler
import threading
import mysql.connector
from concurrent.futures import ThreadPoolExecutor, as_completed

# 로깅 설정
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
logger = logging.getLogger()  # root 로거 가져오기
logger.setLevel(logging.INFO)  # INFO 레벨로 설정

# 기존 핸들러 모두 제거 (필요 시)
if logger.hasHandlers():
    logger.handlers.clear()

# 콘솔 핸들러 추가
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(log_format))
logger.addHandler(console_handler)

# 파일 핸들러 추가
file_handler = logging.FileHandler('logfile.log')
file_handler.setFormatter(logging.Formatter(log_format))
logger.addHandler(file_handler)

# 예제 로그 메시지
logger.info("로깅 설정 완료.")

# 불필요한 로그 비활성화
logging.getLogger('apscheduler').disabled = True
logging.getLogger('apscheduler.executors.default').disabled = True
logging.getLogger('mysql.connector').disabled = True

class BinanceDataFetcher:
    def __init__(self, db_config):
        self.logger = logging.getLogger(__name__)
        self.db_config = db_config
        self.module_name = 'BinanceDataFetcher'

    def _update_module_status(self, status):
        connection = mysql.connector.connect(**self.db_config)
        cursor = connection.cursor()

        update_query = """
        UPDATE bot_info
        SET status = %s
        WHERE name = %s;
        """
        cursor.execute(update_query, (status, self.module_name))
        connection.commit()

        cursor.close()
        connection.close()

    def _log_error(self, error_message):
        connection = mysql.connector.connect(**self.db_config)
        cursor = connection.cursor()

        insert_log_query = """
        INSERT INTO bot_error_logs (bot_name, error_message)
        VALUES (%s, %s);
        """
        cursor.execute(insert_log_query, (self.module_name, error_message))
        connection.commit()

        cursor.close()
        connection.close()

    def _log_update(self, interval, status, message=None):
        """
        인터벌 업데이트 완료 후 로그를 기록하는 함수.
        """
        try:
            connection = mysql.connector.connect(**self.db_config)
            cursor = connection.cursor()

            insert_query = """
            INSERT INTO binance_interval_update_logs (itv, status, message)
            VALUES (%s, %s, %s);
            """
            cursor.execute(insert_query, (interval, status, message))
            connection.commit()

            cursor.close()
            connection.close()

        except mysql.connector.Error as e:
            self.logger.error(f"MySQL logging error: {e}")

    def get_binance_futures_symbols(self):
        try:
            connection = mysql.connector.connect(**self.db_config)
            cursor = connection.cursor()

            query = """
                SELECT symbol_code 
                FROM exchange_info 
                WHERE exchange_code = 'binance'
            """
            cursor.execute(query)
            results = cursor.fetchall()

            perp_symbols = [row[0] for row in results]
            
            cursor.close()
            connection.close()

            self._update_module_status(1)
            return perp_symbols

        except mysql.connector.Error as e:
            self.logger.error(f"MySQL error: {e}")
            self._log_error(f"MySQL error: {e}")
            self._update_module_status(2)

        except Exception as e:
            self.logger.error(f"Error: {e}")
            self._log_error(f"Error: {e}")
            self._update_module_status(2)

    def get_symbol_data(self, symbol, interval):
        url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval={interval}&limit=500"
        response = requests.get(url)
        data = response.json()
        return data

    def _fetch_and_process_symbol(self, symbol, interval):
        try:
            data = self.get_symbol_data(symbol, interval)
            if isinstance(data, dict) and 'code' in data and 'msg' in data:
                #self._log_update(interval, 'error', f"P{interval} start")
                return []

            if not data or not isinstance(data, list) or len(data[0]) < 12:
                self._log_update(interval, 'error', "Invalid data format received.")
                return []

            processed_data = [
                (symbol, interval, row[0], row[1], row[2], row[3], row[4], 
                 row[5], row[6], row[7], row[8], row[9], row[10], row[11])
                for row in data
            ]

            return processed_data

        except RequestException as e:
            self.logger.error(f"Request exception for {symbol} at interval {interval}: {e}")
            return []

    def _update_data_for_interval_db(self, interval):
        symbols = self.get_binance_futures_symbols()
        self.logger.info(f"{interval} update start")

        all_data_to_insert = []

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(self._fetch_and_process_symbol, symbol, interval): symbol for symbol in symbols}

            for future in as_completed(futures):
                symbol = futures[future]
                try:
                    symbol_data = future.result()
                    if symbol_data:
                        all_data_to_insert.extend(symbol_data)
                except Exception as e:
                    self.logger.error(f"Error processing data for {symbol}: {e}")

        # 데이터를 배치로 나누어 처리
        BATCH_SIZE = 1000
        if all_data_to_insert:
            try:
                connection = mysql.connector.connect(**self.db_config)
                cursor = connection.cursor()

                # 데이터를 배치 단위로 쪼개서 삽입
                for i in range(0, len(all_data_to_insert), BATCH_SIZE):
                    batch_data = all_data_to_insert[i:i + BATCH_SIZE]

                    # Prepare query for the batch
                    values_placeholder = ', '.join(['(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)'] * len(batch_data))
                    insert_query = f"""
                    INSERT INTO binance_ohlcv 
                    (symbol, `interval`, timestamp, open, high, low, close, volume, close_time, quote_asset_volume, number_of_trades, taker_buy_base_asset_volume, taker_buy_quote_asset_volume, ignore_column)
                    VALUES {values_placeholder}
                    ON DUPLICATE KEY UPDATE 
                    open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), 
                    volume = VALUES(volume), close_time = VALUES(close_time), 
                    quote_asset_volume = VALUES(quote_asset_volume), number_of_trades = VALUES(number_of_trades), 
                    taker_buy_base_asset_volume = VALUES(taker_buy_base_asset_volume), 
                    taker_buy_quote_asset_volume = VALUES(taker_buy_quote_asset_volume)
                    """

                    # Flatten the batch data
                    flat_batch_data = [item for sublist in batch_data for item in sublist]

                    cursor.execute(insert_query, flat_batch_data)
                    connection.commit()

                cursor.close()
                connection.close()

            except mysql.connector.Error as e:
                self.logger.error(f"MySQL error during bulk insert: {e}")
                self._log_error(f"MySQL error during bulk insert: {e}")
                self._update_module_status(2)
            except Exception as e:
                self.logger.error(f"Exception during bulk insert: {e}")
                self._log_error(f"Exception during bulk insert: {e}")
                self._update_module_status(2)

        self.logger.info(f"{interval} update done")
        self._log_update(interval, 'success', f"{interval} update complete.")

    def schedule_jobs(self):
        scheduler = BackgroundScheduler()
        scheduler.daemonic = True  # 스케줄러를 데몬으로 설정

        scheduler.add_job(lambda: self._update_data_for_interval_db('1d'), 'cron', hour=9, minute=0, max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('1w'), 'cron', day_of_week='sun', hour=9, minute=0, max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('12h'), 'cron', hour='0,12', minute=0, max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('4h'), 'cron', hour='0,4,8,12,16,20', minute=0, max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('1h'), 'cron', minute=0, max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('30m'), 'cron', minute='0,30', max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('15m'), 'cron', minute='0,15,30,45', max_instances=4)
        scheduler.add_job(lambda: self._update_data_for_interval_db('5m'), 'cron', minute='0,5,10,15,20,25,30,35,40,45,50,55', max_instances=4)

        scheduler.start()
        self.logger.info("Scheduler started")  # 스케줄러 시작 로그

    def check_status(self):
        while True:
            try:
                connection = mysql.connector.connect(**self.db_config)
                cursor = connection.cursor()

                query = """
                SELECT status 
                FROM bot_info 
                WHERE name = %s
                """
                cursor.execute(query, (self.module_name,))
                result = cursor.fetchone()

                if result:
                    status = result[0]
                    if status != 1:
                        self.logger.warning(f"Module {self.module_name} status is not normal: {status}")
                
                cursor.close()
                connection.close()
            except mysql.connector.Error as e:
                self.logger.error(f"MySQL error: {e}")
                self._log_error(f"MySQL error: {e}")
            except Exception as e:
                self.logger.error(f"Error: {e}")
                self._log_error(f"Error: {e}")

            time.sleep(5)

if __name__ == '__main__':
    db_config = {
        'host': 'tpsl1.cafe24.com',
        'user': 'tpsl',
        'password': 'asdfqwer1!',
        'database': 'TPSL'
    }
    fetcher = BinanceDataFetcher(db_config)
    
    # 스케줄 작업을 설정 및 시작
    fetcher.schedule_jobs()

    # 상태 확인을 위한 스레드 시작
    status_thread = threading.Thread(target=fetcher.check_status)
    status_thread.daemon = True  # 상태 확인 스레드를 데몬으로 설정
    status_thread.start()
    
    # 메인 루프 실행
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        pass