import requests

def get_okex_futures_symbols():
    url = "https://www.okx.com/api/v5/public/instruments?instType=SWAP"
    response = requests.get(url)
    data = response.json()

    if not isinstance(data, dict) or 'data' not in data or not isinstance(data['data'], list):
        print("Unexpected response format:", data)
        return []

    markets = [item['instId'].replace('-', '').replace('SWAP', '') for item in data['data'] if item['instId'].endswith('USDT-SWAP')]
    
    return markets

if __name__ == '__main__':
    get_okex_futures_symbols()
