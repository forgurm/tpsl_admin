import requests

def get_bitget_futures_symbols():
    url = "https://api.bitget.com/api/mix/v1/market/contracts"
    params = {
        'productType': 'umcbl'  # Assuming 'umcbl' for USDT-M contracts; adjust if necessary
    }
    response = requests.get(url, params=params)
    
    try:
        data = response.json()
        # Debugging statement to print the API response
        #print("API Response:", data)
        
        if not isinstance(data, dict) or 'data' not in data or data['data'] is None:
            print("Unexpected response format or no data:", data)
            return []

        # Extracting symbols that are perpetual futures and end with 'USDT'
        symbols = [item['symbolName'] for item in data['data'] if item['symbolType'] == 'perpetual' and item['symbolName'].endswith('USDT')]
        #print(symbols)
        return symbols
    except Exception as e:
        print(f"Error parsing response: {str(e)}")
        return []

if __name__ == '__main__':
    get_bitget_futures_symbols()
