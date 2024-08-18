import requests

APIURL = "https://open-api.bingx.com"

def get_bingx_futures_symbols():
    path = '/openApi/swap/v2/quote/contracts'  # Adjusted endpoint for futures symbols
    url = f"{APIURL}{path}"
    response = requests.get(url)
    
    try:
        data = response.json()
        symbols = [item['symbol'].replace('-', '') for item in data['data']]  # Adjusted parsing according to futures symbols structure
        return symbols
    except Exception as e:
        print(f"Error parsing response: {str(e)}")
        return []

if __name__ == '__main__':
    get_bingx_futures_symbols()
    #print("BingX Futures Symbols:\n", bingx_symbols)
