#api key = 61e44850e81040169eda74ddb19cd10b
#secret key = b038e54560eb1318e6b2a150df3f6aee6a2e9ec56c1e7defa0dd108d8910c59e

import requests

def get_kine_markets():
    url = "https://api.kine.exchange/market/api/agg-price"  # KINE's endpoint for aggregated asset prices
    response = requests.get(url)
    data = response.json()

    # Check if response format is as expected
    if 'data' not in data or 'prices' not in data['data']:
        print("Unexpected response format:", data)
        return []

    # Extracting the 'symbol' from each item in the 'prices' list
    markets = ["'" + item['symbol'] + "'" for item in data['data']['prices']]
    return ',\n'.join(markets)

# Get the list of markets from KINE
kine_markets_list = get_kine_markets()
print("kine_markets_list =", kine_markets_list)
