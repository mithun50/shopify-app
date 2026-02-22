import UIKit
import UserNotifications

extension Notification.Name {
    static let notificationTapped = Notification.Name("notificationTapped")
}

class NotificationHelper: NSObject, UNUserNotificationCenterDelegate {

    static let shared = NotificationHelper()

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    func scheduleLocalNotification(title: String, body: String, timeInterval: TimeInterval, identifier: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: timeInterval, repeats: false)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }

    func scheduleWelcomeBackReminder() {
        // Remove any existing welcome-back notification before scheduling
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["welcome_back"])

        scheduleLocalNotification(
            title: "{{APP_NAME}}",
            body: "Welcome back! Check out new arrivals and deals.",
            timeInterval: 24 * 60 * 60,
            identifier: "welcome_back"
        )
    }

    // MARK: - UNUserNotificationCenterDelegate

    // Show notification even when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .badge, .sound])
    }

    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        let url = userInfo["url"] as? String

        NotificationCenter.default.post(
            name: .notificationTapped,
            object: nil,
            userInfo: url != nil ? ["url": url!] : nil
        )

        completionHandler()
    }
}
