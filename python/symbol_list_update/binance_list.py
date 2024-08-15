import requests

def get_binance_futures_symbols():
    url = "https://fapi.binance.com/fapi/v1/exchangeInfo"
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()

    # Filter symbols that end with 'USDT'
    futures_markets = [item['symbol'] for item in data['symbols'] if item['symbol'].endswith('USDT')]

    return futures_markets

if __name__ == '__main__':
    symbols = get_binance_futures_symbols()
    print(symbols)  # Print the symbols to verify
