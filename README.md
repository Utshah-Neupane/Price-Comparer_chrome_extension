# 🛒 Price Comparer Chrome Extension

A powerful Chrome extension that helps you compare product prices across multiple retailers with a single click. Currently supports Walmart, Target, and Kroger.

![Price Comparer Demo](https://via.placeholder.com/400x500/667eea/ffffff?text=Price+Comparer+Demo)

## ✨ Features

- **One-Click Price Check**: Get the current product's price instantly
- **Cross-Store Comparison**: Compare prices across Walmart, Target, and Kroger
- **Smart Product Matching**: Advanced algorithms to find matching products across different retailers
- **Clean Interface**: Simple and intuitive popup design
- **Lightweight**: Minimal impact on browser performance

## 🚀 Installation

### Method 1: Load Unpacked Extension (For Development)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" and select the extension directory

### Method 2: Install from Chrome Web Store (Coming Soon)

> ⚠️ Note: This extension is not yet published to the Chrome Web Store. Follow the "Load Unpacked" instructions above to use it.

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

## 📂 Project Structure

```
Price-Comparer_chrome_extension/
├── manifest.json    # Extension configuration
├── background.js    # Background service worker
├── content.js       # Content scripts
├── index.html       # Popup UI
├── style.css        # Styling
├── README.md        # This file
└── LICENSE          # License information
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Setup for Development

1. Fork the repository
2. Clone your fork
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📬 Contact

For feature requests or bug reports, please [open an issue](https://github.com/yourusername/Price-Comparer_chrome_extension/issues).

---

Made with ❤️ by [Your Name]