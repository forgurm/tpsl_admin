import requests

def get_bybit_futures_symbols():
    url = "https://api.bybit.com/v2/public/symbols"
    response = requests.get(url)
    data = response.json()

    if not isinstance(data, dict) or 'result' not in data:
        print("Unexpected response format:", data)
        return []

    futures_markets = [item['name'] for item in data['result'] if item['quote_currency'] == 'USDT']
    return futures_markets

if __name__ == '__main__':
    get_bybit_futures_symbols()
    
