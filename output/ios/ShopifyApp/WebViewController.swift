import UIKit
import WebKit

class WebViewController: UIViewController {

    private let storeURL = "https://brodrops.com"

    private var webView: WKWebView!
    private var progressView: UIProgressView!
    private var refreshControl: UIRefreshControl!
    private var offlineView: UIView!
    private var progressObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        setupProgressView()
        setupRefreshControl()
        setupOfflineView()
        loadStore()
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        config.websiteDataStore = .default()

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic

        let userAgent = webView.value(forKey: "userAgent") as? String ?? ""
        webView.customUserAgent = userAgent + " ShopifyApp/1.0"

        view.addSubview(webView)

        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] _, change in
            guard let progress = change.newValue else { return }
            self?.progressView.setProgress(Float(progress), animated: true)
            if progress >= 1.0 {
                UIView.animate(withDuration: 0.3, delay: 0.3) {
                    self?.progressView.alpha = 0
                } completion: { _ in
                    self?.progressView.setProgress(0, animated: false)
                }
            } else {
                self?.progressView.alpha = 1
            }
        }
    }

    private func setupProgressView() {
        progressView = UIProgressView(progressViewStyle: .bar)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = UIColor(hex: "#000000")
        view.addSubview(progressView)

        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 3)
        ])
    }

    private func setupRefreshControl() {
        refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(hex: "#000000")
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
    }

    private func setupOfflineView() {
        offlineView = UIView(frame: view.bounds)
        offlineView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        offlineView.backgroundColor = .white
        offlineView.isHidden = true

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = UILabel()
        titleLabel.text = "No Internet Connection"
        titleLabel.font = .boldSystemFont(ofSize: 20)
        titleLabel.textColor = UIColor(white: 0.2, alpha: 1)

        let subtitleLabel = UILabel()
        subtitleLabel.text = "Please check your connection and try again"
        subtitleLabel.font = .systemFont(ofSize: 14)
        subtitleLabel.textColor = UIColor(white: 0.4, alpha: 1)
        subtitleLabel.textAlignment = .center

        let retryButton = UIButton(type: .system)
        retryButton.setTitle("Retry", for: .normal)
        retryButton.titleLabel?.font = .boldSystemFont(ofSize: 16)
        retryButton.backgroundColor = UIColor(hex: "#000000")
        retryButton.setTitleColor(.white, for: .normal)
        retryButton.layer.cornerRadius = 8
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 32, bottom: 12, right: 32)
        retryButton.addTarget(self, action: #selector(handleRetry), for: .touchUpInside)

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(subtitleLabel)
        stack.addArrangedSubview(retryButton)

        offlineView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: offlineView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offlineView.centerYAnchor)
        ])

        view.addSubview(offlineView)
    }

    private func loadStore() {
        guard let url = URL(string: storeURL) else { return }
        let request = URLRequest(url: url)
        webView.load(request)
    }

    @objc private func handleRefresh() {
        webView.reload()
    }

    @objc private func handleRetry() {
        offlineView.isHidden = true
        webView.isHidden = false
        loadStore()
    }

    private func showOffline() {
        offlineView.isHidden = false
        webView.isHidden = true
    }

    @objc func shareCurrentPage() {
        guard let url = webView.url else { return }
        let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        present(activityVC, animated: true)
    }

    deinit {
        progressObservation = nil
    }
}

// MARK: - WKNavigationDelegate
extension WebViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, let host = url.host else {
            decisionHandler(.allow)
            return
        }

        let storeHost = URL(string: storeURL)?.host ?? ""

        // Allow Shopify-related domains
        if host == storeHost || host.hasSuffix(".shopify.com") || host.hasSuffix(".shopifycdn.com") {
            decisionHandler(.allow)
            return
        }

        // Open external links in Safari
        if navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()
        offlineView.isHidden = true
        webView.isHidden = false
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        refreshControl.endRefreshing()
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorNotConnectedToInternet {
            showOffline()
        }
    }
}

// MARK: - WKUIDelegate
extension WebViewController: WKUIDelegate {

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
}

// MARK: - UIColor Hex Extension
extension UIColor {
    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)

        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
