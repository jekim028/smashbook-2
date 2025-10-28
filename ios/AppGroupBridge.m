//
//  AppGroupBridge.m
//  Smashbook
//
//  React Native bridge for AppGroupBridge
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupBridge, NSObject)

RCT_EXTERN_METHOD(getAppGroupPath:(NSString *)appGroupId
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end

