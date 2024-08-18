import requests

def get_bitmart_futures_symbols():
    url = "https://api-cloud.bitmart.com/contract/v1/tickers"
    response = requests.get(url)
    
    try:
        data = response.json()
        
        if not isinstance(data, dict) or 'data' not in data or 'tickers' not in data['data']:
            print("Unexpected response format:", data)
            return []

        symbols = [item['contract_symbol'].replace('_', '') for item in data['data']['tickers'] if 'USDC' not in item['contract_symbol']]
        return symbols
    except Exception as e:
        print(f"Error parsing response: {str(e)}")
        return []

if __name__ == '__main__':
    symbols = get_bitmart_futures_symbols()
    print("BitMart Futures Symbols:\n", symbols)
