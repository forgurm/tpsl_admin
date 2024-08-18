import mysql.connector

class SymbolMapper:
    def __init__(self, host, database, user, password):
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.connection = None

    def connect(self):
        if self.connection is None or not self.connection.is_connected():
            self.connection = mysql.connector.connect(
                host=self.host,
                database=self.database,
                user=self.user,
                password=self.password
            )

    def close(self):
        if self.connection and self.connection.is_connected():
            self.connection.close()

    def get_symbol_name(self, exchange_code, symbol_code):
        self.connect()
        
        cursor = self.connection.cursor()
        query = """
            SELECT symbol_name 
            FROM exchange_info 
            WHERE exchange_code = %s AND symbol_code = %s
        """
        cursor.execute(query, (exchange_code, symbol_code))
        result = cursor.fetchone()
        cursor.close()

        if result:
            return result[0]
        else:
            return None
