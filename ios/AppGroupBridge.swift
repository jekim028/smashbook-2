//
//  AppGroupBridge.swift
//  Smashbook
//
//  Exposes the App Group container URL to React Native
//

import Foundation

@objc(AppGroupBridge)
class AppGroupBridge: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func getAppGroupPath(_ appGroupId: String, 
                       resolver: @escaping RCTPromiseResolveBlock,
                       rejecter: @escaping RCTPromiseRejectBlock) {
    guard let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupId
    ) else {
      rejecter("E_APP_GROUP", "Could not access App Group: \(appGroupId)", nil)
      return
    }
    
    resolver(containerURL.path)
  }
}

