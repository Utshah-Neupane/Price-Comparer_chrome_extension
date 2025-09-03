# 🛒 Price Comparer Chrome Extension

A powerful Chrome extension that helps you compare product prices across multiple retailers with a single click. Currently supports Walmart, Target, and Kroger.

![Price Comparer Demo](https://www.loom.com/share/74126bf0f98548f6a68b5f9e340d037c?sid=6b536e8e-86cb-445b-a1dc-0235eba0fb18)

## ✨ Features

- **One-Click Price Check**: Get the current product's price instantly
- **Cross-Store Comparison**: Compare prices across Walmart, Target, and Kroger
- **Smart Product Matching**: Advanced algorithms to find matching products across different retailers
- **Clean Interface**: Simple and intuitive popup design
- **Lightweight**: Minimal impact on browser performance

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select the extension directory


## 🛠️ How It Works

1. Navigate to a product page on Walmart, Target, or Kroger
2. Click the extension icon in your toolbar
3. Click "Get Price" to:
   - See the current product's price
   - View price comparisons from other retailers

## 🔧 Technical Details

- **Manifest V3** compliant
- Background service worker for price scraping
- Responsive popup UI
- Smart product matching using Jaccard similarity
- Handles dynamic content loading

### Supported Websites

- ✅ [Walmart](https://www.walmart.com)
- ✅ [Target](https://www.target.com)
- ✅ [Kroger](https://www.kroger.com)



## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
