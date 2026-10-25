import requests
from bs4 import BeautifulSoup

def scrape_hacktoberfest_stats():
    url = 'https://hacktoberfest.com'
    resp = requests.get(url)
    print('Fetched stats')