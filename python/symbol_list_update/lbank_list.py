import requests

def get_lbank_futures_symbols():
    url = "https://api.lbkex.com/v2/currencyPairs.do"
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()

    # Filter symbols that end with 'usdt' and do not contain '3L', '3S', '5L', '5S'
    futures_markets = [item for item in data['data'] 
                       if item.lower().endswith('usdt') and 
                       all(x not in item.upper() for x in ['3L', '3S', '5L', '5S'])]

    return futures_markets

if __name__ == '__main__':
    symbols = get_lbank_futures_symbols()
    print(symbols)  # Print the symbols to verify
