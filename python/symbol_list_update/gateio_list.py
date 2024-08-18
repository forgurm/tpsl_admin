import requests

def get_gateio_futures_symbols():
    url = "https://api.gateio.ws/api/v4/futures/usdt/contracts"  # Correct endpoint for futures symbols
    response = requests.get(url)
    data = response.json()

    if not isinstance(data, list):
        print("Unexpected response format:", data)
        return []

    symbols = [item['name'].replace('_', '') for item in data]
    
    return symbols

if __name__ == '__main__':
    gateio_markets = get_gateio_futures_symbols()

