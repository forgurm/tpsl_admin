import time
import json
import schedule
import datetime
import mysql.connector
from mysql.connector import Error
import config
from bybit_list import get_bybit_futures_symbols
from binance_list import get_binance_futures_symbols
from bingx_list import get_bingx_futures_symbols
from bitget_list import get_bitget_futures_symbols
from okex_list import get_okex_futures_symbols
from bitmart_list import get_bitmart_futures_symbols
from gateio_list import get_gateio_futures_symbols
from lbank_list import get_lbank_futures_symbols
from symbol_mapper import SymbolMapper

def clean_symbols(symbols):
    """
    심볼 리스트에서 'usdt', 'USDT', '_USDT', '_usdt'를 제거하고 대문자로 변환합니다.
    """
    cleaned_symbols = set()
    for symbol in symbols:
        upper_symbol = symbol.upper()
        if not (upper_symbol.endswith('USDT') or upper_symbol.endswith('_USDT')):
            cleaned_symbols.add(upper_symbol)
    return cleaned_symbols

def update_symbols_in_db(exchange_code, exchange_name, fetch_symbols_func):
    # Fetch new symbols
    new_symbols = set(fetch_symbols_func())

    try:
        connection = mysql.connector.connect(
            host=config.DB_host,
            database=config.DB_database,
            user=config.DB_user,
            password=config.DB_password
        )
        if connection.is_connected():
            db_cursor = connection.cursor()

            # Fetch existing symbols for the exchange
            db_cursor.execute("SELECT symbol_code FROM exchange_info WHERE exchange_code = %s", (exchange_code,))
            existing_symbols = set(record[0] for record in db_cursor.fetchall())

            # Insert new symbols
            new_entries = new_symbols - existing_symbols
            if new_entries:
                db_cursor.executemany(
                    "INSERT INTO exchange_info (exchange_code, exchange_name, symbol_code) VALUES (%s, %s, %s)",
                    [(exchange_code, exchange_name, symbol) for symbol in new_entries]
                )
                # Clean the new symbols and prepare message
            cleaned_symbols = clean_symbols(new_entries)
            if cleaned_symbols:
                symbols_list = ", ".join(cleaned_symbols)
                msg = f"- {exchange_name} : {symbols_list}"
                return msg

            # Delete old symbols
            old_entries = existing_symbols - new_symbols
            if old_entries:
                db_cursor.executemany(
                    "DELETE FROM exchange_info WHERE symbol_code = %s AND exchange_code = %s",
                    [(symbol, exchange_code) for symbol in old_entries]
                )

            connection.commit()
            print(f"Updated {exchange_name} symbols. New: {len(new_entries)}, Deleted: {len(old_entries)}")
    except Error as e:
        print(f"Error while connecting to MySQL: {e}")
    finally:
        if connection.is_connected():
            db_cursor.close()
            connection.close()

def job():
    exchanges = [
        {
            "exchange_code": "bybit",
            "exchange_name": "바이빗",
            "fetch_symbols_func": get_bybit_futures_symbols
        },
        {
            "exchange_code": "binance",
            "exchange_name": "바이낸스",
            "fetch_symbols_func": get_binance_futures_symbols
        },
        {
            "exchange_code": "bingx",
            "exchange_name": "빙엑스",
            "fetch_symbols_func": get_bingx_futures_symbols
        },
        {
            "exchange_code": "bitget",
            "exchange_name": "비트겟",
            "fetch_symbols_func": get_bitget_futures_symbols
        },
        {
            "exchange_code": "okex",
            "exchange_name": "오케이엑스",
            "fetch_symbols_func": get_okex_futures_symbols
        },
        {
            "exchange_code": "bitmart",
            "exchange_name": "비트마트",
            "fetch_symbols_func": get_bitmart_futures_symbols
        },
        {
            "exchange_code": "gateio",
            "exchange_name": "게이트아이오",
            "fetch_symbols_func": get_gateio_futures_symbols
        },
        {
            "exchange_code": "lbank",
            "exchange_name": "엘뱅크",
            "fetch_symbols_func": get_lbank_futures_symbols
        }
    ]
    
    messages = []
    for exchange in exchanges:
        print(f"Updating {exchange['exchange_name']} symbols...")
        msg = update_symbols_in_db(exchange['exchange_code'], exchange['exchange_name'], exchange['fetch_symbols_func'])
        if msg:
            messages.append(msg)
        print(f"Update complete for {exchange['exchange_name']} at", datetime.datetime.now())

    if messages:
        final_message = "\n".join(messages)

if __name__ == '__main__':
    print("Symbol list will be updated daily at 9 AM.")
    job()
    # schedule.every().day.at("09:00").do(job)
    schedule.every().hour.at(":00").do(job)
    while True:
        schedule.run_pending()
        time.sleep(1)
