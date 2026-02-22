import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = WebViewController()
        window?.tintColor = UIColor(hex: "#000000")
        window?.makeKeyAndVisible()

        // Handle deep links on launch
        if let urlContext = connectionOptions.urlContexts.first {
            handleDeepLink(urlContext.url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            handleDeepLink(url)
        }
    }

    private func handleDeepLink(_ url: URL) {
        if let webVC = window?.rootViewController as? WebViewController {
            // Load the deep link URL in the webview
        }
    }
}
