import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

@objc(ShareExtensionViewController)
class ShareExtensionViewController: UIViewController {
    
    private let appGroupID = "group.com.juliarhee.smashbook2"
    private var shareItems: [[String: Any]] = []
    
    // MARK: - UI Elements
    private lazy var containerView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(red: 253/255, green: 252/255, blue: 248/255, alpha: 1.0)
        view.layer.cornerRadius = 16
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOpacity = 0.2
        view.layer.shadowOffset = CGSize(width: 0, height: 4)
        view.layer.shadowRadius = 8
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.text = "Save to Smashbook"
        label.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        label.textColor = UIColor(red: 26/255, green: 49/255, blue: 64/255, alpha: 1.0)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var statusLabel: UILabel = {
        let label = UILabel()
        label.text = "Processing..."
        label.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        label.textColor = UIColor(red: 26/255, green: 49/255, blue: 64/255, alpha: 0.8)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()
    
    private lazy var openAppButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Done", for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        button.isHidden = true
        button.addTarget(self, action: #selector(openMainApp), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    // MARK: - Lifecycle
  override func viewDidLoad() {
    super.viewDidLoad()
        setupUI()
        processSharedContent()
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        
        view.addSubview(containerView)
        containerView.addSubview(titleLabel)
        containerView.addSubview(statusLabel)
        containerView.addSubview(activityIndicator)
        containerView.addSubview(openAppButton)
        
    NSLayoutConstraint.activate([
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 40),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -40),
            containerView.heightAnchor.constraint(greaterThanOrEqualToConstant: 200),
            
            titleLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 24),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            
            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 24),
            
            statusLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            
            openAppButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 16),
            openAppButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            openAppButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -24),
            openAppButton.heightAnchor.constraint(equalToConstant: 44)
        ])
        
        activityIndicator.startAnimating()
    }
    
    // MARK: - Content Processing
    private func processSharedContent() {
        print("[ShareExtension] ========== processSharedContent START ==========")
        
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem] else {
            print("[ShareExtension] ❌ No extension context or input items")
            showError("No content to share")
            return
          }
          
        print("[ShareExtension] Input items count: \(inputItems.count)")
          
        let group = DispatchGroup()
        
        for (itemIndex, item) in inputItems.enumerated() {
            guard let attachments = item.attachments else {
                print("[ShareExtension] Item \(itemIndex) has no attachments")
                continue
            }
            
            print("[ShareExtension] Item \(itemIndex) has \(attachments.count) attachments")
            
            for (attachIndex, provider) in attachments.enumerated() {
                print("[ShareExtension] Processing attachment \(itemIndex).\(attachIndex)")
                print("[ShareExtension] - Has URL: \(provider.hasItemConformingToTypeIdentifier(UTType.url.identifier))")
                print("[ShareExtension] - Has Text: \(provider.hasItemConformingToTypeIdentifier(UTType.text.identifier))")
                print("[ShareExtension] - Has Image: \(provider.hasItemConformingToTypeIdentifier(UTType.image.identifier))")
                
                group.enter()
                
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    print("[ShareExtension] → Handling as URL")
                    handleURL(provider: provider, group: group)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                    print("[ShareExtension] → Handling as Text")
                    handleText(provider: provider, group: group)
                } else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    print("[ShareExtension] → Handling as Image")
                    handleImage(provider: provider, group: group)
                } else {
                    print("[ShareExtension] → Unknown type, skipping")
                    group.leave()
                }
            }
        }
        
        print("[ShareExtension] Waiting for all handlers to complete...")
        group.notify(queue: .main) { [weak self] in
            print("[ShareExtension] All handlers complete, saving to storage...")
            self?.saveToSharedStorage()
        }
    }
    
    private func handleURL(provider: NSItemProvider, group: DispatchGroup) {
        provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
            defer { group.leave() }
            
            if let error = error {
                print("Error loading URL: \(error)")
                return
            }
            
            var urlString: String?
            if let url = item as? URL {
                urlString = url.absoluteString
            } else if let data = item as? Data, let str = String(data: data, encoding: .utf8) {
                urlString = str
            }
            
            if let urlString = urlString {
                let shareId = UUID().uuidString
                self?.shareItems.append([
                    "id": shareId,
                    "type": "url",
                    "timestamp": Int(Date().timeIntervalSince1970 * 1000),
                    "processed": false,
                    "data": [
                        "url": urlString
                    ]
                ])
            }
        }
    }
    
    private func handleText(provider: NSItemProvider, group: DispatchGroup) {
        provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { [weak self] (item, error) in
            defer { group.leave() }
            
            if let error = error {
                print("Error loading text: \(error)")
      return
    }
    
            if let text = item as? String {
                let shareId = UUID().uuidString
                self?.shareItems.append([
                    "id": shareId,
                    "type": "text",
                    "timestamp": Int(Date().timeIntervalSince1970 * 1000),
                    "processed": false,
                    "data": [
                        "text": text
                    ]
                ])
            }
        }
    }
    
    private func handleImage(provider: NSItemProvider, group: DispatchGroup) {
        print("[ShareExtension] 📸 handleImage called")
        provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] (item, error) in
            defer { group.leave() }
            
            guard let self = self else {
                print("[ShareExtension] ❌ self is nil in handleImage")
                return
              }
              
            if let error = error {
                print("[ShareExtension] ❌ Error loading image: \(error)")
                return
              }
              
            print("[ShareExtension] 📸 Image item type: \(type(of: item))")
              
            var imageURL: URL?
            
            if let url = item as? URL {
                print("[ShareExtension] ✅ Image is URL: \(url.absoluteString)")
                imageURL = url
            } else if let data = item as? Data {
                print("[ShareExtension] ✅ Image is Data, size: \(data.count) bytes")
                // Save data to temporary file
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                    .appendingPathExtension("jpg")
                do {
                    try data.write(to: tempURL)
                    print("[ShareExtension] ✅ Wrote data to temp file: \(tempURL.path)")
                    imageURL = tempURL
                    } catch {
                    print("[ShareExtension] ❌ Failed to write data: \(error)")
                }
            } else if let image = item as? UIImage {
                print("[ShareExtension] ✅ Image is UIImage, size: \(image.size)")
                if let data = image.jpegData(compressionQuality: 0.8) {
                    let tempURL = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString)
                        .appendingPathExtension("jpg")
                    do {
                        try data.write(to: tempURL)
                        print("[ShareExtension] ✅ Converted UIImage to file: \(tempURL.path)")
                        imageURL = tempURL
                    } catch {
                        print("[ShareExtension] ❌ Failed to write UIImage: \(error)")
                    }
                } else {
                    print("[ShareExtension] ❌ Failed to convert UIImage to JPEG data")
                }
            } else {
                print("[ShareExtension] ⚠️ Unknown image type: \(type(of: item))")
            }
            
            if let imageURL = imageURL {
                print("[ShareExtension] 📸 Processing image from: \(imageURL.path)")
                print("[ShareExtension] 📸 File exists: \(FileManager.default.fileExists(atPath: imageURL.path))")
                
                // Copy to shared storage
                if let sharedURL = self.copyFileToSharedStorage(fileURL: imageURL) {
                    let shareId = UUID().uuidString
                    print("[ShareExtension] ✅ Image copied to shared storage: \(sharedURL.path)")
                    self.shareItems.append([
                        "id": shareId,
                        "type": "image",
                        "timestamp": Int(Date().timeIntervalSince1970 * 1000),
                        "processed": false,
                        "data": [
                            "imageUri": sharedURL.path
                        ]
                    ])
                    print("[ShareExtension] ✅ shareItems count: \(self.shareItems.count)")
                } else {
                    print("[ShareExtension] ❌ Failed to copy to shared storage")
                }
              } else {
                print("[ShareExtension] ❌ Could not extract imageURL")
            }
        }
    }
    
    // MARK: - Shared Storage
    private func copyFileToSharedStorage(fileURL: URL) -> URL? {
        print("[ShareExtension] 💾 copyFileToSharedStorage called with: \(fileURL.path)")
        
        guard let sharedDirectory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            print("[ShareExtension] ❌ Could not access App Group directory: \(appGroupID)")
            return nil
        }
        
        print("[ShareExtension] ✅ App Group directory: \(sharedDirectory.path)")
        
        let sharedFilesDir = sharedDirectory.appendingPathComponent("shared_files", isDirectory: true)
        print("[ShareExtension] 📁 Shared files directory: \(sharedFilesDir.path)")
        
        // Create directory if it doesn't exist
        do {
            try FileManager.default.createDirectory(at: sharedFilesDir, withIntermediateDirectories: true)
            print("[ShareExtension] ✅ Created/verified shared_files directory")
        } catch {
            print("[ShareExtension] ❌ Failed to create directory: \(error)")
        }
        
        let fileName = "\(UUID().uuidString).\(fileURL.pathExtension)"
        let destinationURL = sharedFilesDir.appendingPathComponent(fileName)
        print("[ShareExtension] 🎯 Destination: \(destinationURL.path)")
        
        do {
            if FileManager.default.fileExists(atPath: destinationURL.path) {
                print("[ShareExtension] 🗑 Removing existing file")
                try FileManager.default.removeItem(at: destinationURL)
            }
            
            print("[ShareExtension] 📋 Copying file...")
            try FileManager.default.copyItem(at: fileURL, to: destinationURL)
            print("[ShareExtension] ✅ File copied successfully")
            
            let attributes = try FileManager.default.attributesOfItem(atPath: destinationURL.path)
            if let fileSize = attributes[.size] as? Int {
                print("[ShareExtension] 📊 File size: \(fileSize) bytes")
            }
            
            return destinationURL
        } catch {
            print("[ShareExtension] ❌ Error copying file: \(error)")
            return nil
        }
    }
    
    private func saveToSharedStorage() {
        print("[ShareExtension] Starting saveToSharedStorage...")
        print("[ShareExtension] shareItems count: \(shareItems.count)")
        
        guard !shareItems.isEmpty else {
            print("[ShareExtension] ERROR: No shareItems to save")
            showError("No content found to share")
                return
              }
              
        print("[ShareExtension] Looking for App Group: \(appGroupID)")
        guard let sharedDirectory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            print("[ShareExtension] ERROR: Could not access App Group")
            showError("Could not access shared storage")
                return
              }
              
        print("[ShareExtension] App Group directory: \(sharedDirectory.path)")
        let pendingSharesFile = sharedDirectory.appendingPathComponent("pending_shares.json")
        print("[ShareExtension] Pending shares file: \(pendingSharesFile.path)")
        
        // Read existing shares
        var allShares: [[String: Any]] = []
        if FileManager.default.fileExists(atPath: pendingSharesFile.path) {
            print("[ShareExtension] Found existing pending_shares.json")
            if let data = try? Data(contentsOf: pendingSharesFile),
               let existing = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                allShares = existing
                print("[ShareExtension] Loaded \(existing.count) existing shares")
            }
        } else {
            print("[ShareExtension] No existing pending_shares.json, creating new")
        }
        
        // Add new shares
        print("[ShareExtension] Adding \(shareItems.count) new shares")
        allShares.append(contentsOf: shareItems)
        print("[ShareExtension] Total shares to save: \(allShares.count)")
        
        // Save back
        do {
            let data = try JSONSerialization.data(withJSONObject: allShares, options: .prettyPrinted)
            try data.write(to: pendingSharesFile)
            print("[ShareExtension] ✅ Successfully saved to: \(pendingSharesFile.path)")
            print("[ShareExtension] File size: \(data.count) bytes")
            
            // Verify the file was written
            if FileManager.default.fileExists(atPath: pendingSharesFile.path) {
                print("[ShareExtension] ✅ Verified file exists")
            } else {
                print("[ShareExtension] ⚠️ WARNING: File does not exist after writing!")
            }
            
            showSuccess()
                  } catch {
            print("[ShareExtension] ❌ ERROR saving: \(error.localizedDescription)")
            showError("Failed to save: \(error.localizedDescription)")
        }
    }
    
    // MARK: - UI Updates
    private func showSuccess() {
        activityIndicator.stopAnimating()
        activityIndicator.isHidden = true
        statusLabel.text = "✓ Saved! Open Smashbook to see it."
        statusLabel.textColor = UIColor(red: 52/255, green: 199/255, blue: 89/255, alpha: 1.0) // Green
        openAppButton.isHidden = false
        
        // No auto-dismiss - user must tap "Done" button
    }
    
    private func showError(_ message: String) {
        activityIndicator.stopAnimating()
        activityIndicator.isHidden = true
        statusLabel.text = "✗ \(message)"
        statusLabel.textColor = UIColor(red: 255/255, green: 59/255, blue: 48/255, alpha: 1.0) // Red
        
        // Auto-dismiss after 5 seconds for errors (give user time to read)
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
            self?.extensionContext?.cancelRequest(withError: NSError(domain: "ShareExtension", code: -1))
        }
    }
    
    @objc private func openMainApp() {
        print("[ShareExtension] Button tapped - dismissing extension")
        // iOS restrictions prevent reliably opening the main app from an extension
        // User will manually open Smashbook and the content will auto-import
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
