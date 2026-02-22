import Foundation
import UIKit
import VisionKit

@objcMembers
public class DocumentScannerController: NSObject, VNDocumentCameraViewControllerDelegate {

    private let maxPages: Int
    private let tempDirectory: URL
    private let completion: (Result<[URL], Error>) -> Void
    private var viewController: VNDocumentCameraViewController?

    init(maxPages: Int, tempDirectory: URL, completion: @escaping (Result<[URL], Error>) -> Void) {
        self.maxPages = maxPages
        self.tempDirectory = tempDirectory
        self.completion = completion
        super.init()
    }

    func present() {
        let vc = VNDocumentCameraViewController()
        vc.delegate = self
        viewController = vc

        guard let rootVC = Self.topViewController() else {
            completion(.failure(NSError(
                domain: "NeuroScan",
                code: -2,
                userInfo: [NSLocalizedDescriptionKey: "No root view controller found"]
            )))
            return
        }

        rootVC.present(vc, animated: true)
    }

    // MARK: - VNDocumentCameraViewControllerDelegate

    public func documentCameraViewController(
        _ controller: VNDocumentCameraViewController,
        didFinishWith scan: VNDocumentCameraScan
    ) {
        controller.dismiss(animated: true)

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            var urls: [URL] = []
            let pageCount = min(scan.pageCount, self.maxPages)

            for i in 0..<pageCount {
                let image = scan.imageOfPage(at: i)
                let url = self.tempDirectory.appendingPathComponent("\(UUID().uuidString).jpg")

                if let data = image.jpegData(compressionQuality: 0.9) {
                    do {
                        // Ensure directory exists
                        if !FileManager.default.fileExists(atPath: self.tempDirectory.path) {
                            try FileManager.default.createDirectory(
                                at: self.tempDirectory,
                                withIntermediateDirectories: true
                            )
                        }
                        try data.write(to: url)
                        urls.append(url)
                    } catch {
                        // Skip this page but continue
                    }
                }
            }

            self.completion(.success(urls))
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        completion(.failure(NSError(
            domain: "NeuroScan",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "Scanner cancelled"]
        )))
    }

    public func documentCameraViewController(
        _ controller: VNDocumentCameraViewController,
        didFailWithError error: Error
    ) {
        controller.dismiss(animated: true)
        completion(.failure(error))
    }

    // MARK: - Helpers

    private static func topViewController(
        base: UIViewController? = nil
    ) -> UIViewController? {
        let base = base ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController

        if let nav = base as? UINavigationController {
            return topViewController(base: nav.visibleViewController)
        }
        if let tab = base as? UITabBarController, let selected = tab.selectedViewController {
            return topViewController(base: selected)
        }
        if let presented = base?.presentedViewController {
            return topViewController(base: presented)
        }
        return base
    }
}
