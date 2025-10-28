# Day Sharing Feature - Setup Guide

This guide explains how to set up and deploy the day sharing feature for Smashbook.

## 🎯 Feature Overview

The day sharing feature allows users to:
- Share an entire day's memories via a link
- Text the link to friends (shows rich preview with image)
- Recipients can view the shared day in a web browser
- Tapping "View in Smashbook" opens the app to that day

## 📋 What You Have

### App Components
- **`app/utils/daySharing.ts`**: Core sharing logic
- **`app/components/DayDivider.tsx`**: Share button in date banners
- **`app/(auth)/shared-day/[shareId].tsx`**: In-app view for shared days
- **`hooks/useSharedContent.ts`**: Already updated for local storage

### Web Components
- **`public/index.html`**: Simple landing page
- **`public/day.html`**: Dynamic landing page with Firebase integration
- **`firebase.json`**: Firebase Hosting configuration
- **`firestore.rules`**: Updated to allow public read of shared days

## 🚀 Quick Start (For Demo)

### 1. Test Locally

The share feature works in the app right now! 

1. Open the app
2. Find a day with photos
3. Tap the **share icon** (📤) in the date banner
4. Choose "Messages" to text it
5. Send to your mom or anyone

The link will be: `https://smashbook.app/day/[shareId]`

### 2. What Happens When Shared

**In iMessage/SMS:**
- Shows "View my Smashbook" 
- Shows the date (e.g., "December 20, 2024")
- Shows preview image (first photo from that day)
- Tapping opens: Deep link → App opens to that day

**If App Not Installed:**
- Opens web page with all the day's photos
- Shows "View in Smashbook" button
- Can still view the memories in browser

## 🌐 Deploy to Production (Optional)

To get real rich previews in texts, you need to deploy the web landing page:

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### Step 2: Initialize Firebase (if not done)

```bash
firebase init hosting
# Select your Firebase project: smashbook-ae1b0
# Public directory: public
# Single-page app: No
# Overwrite files: No
```

### Step 3: Deploy Hosting

```bash
firebase deploy --only hosting
```

### Step 4: Update Domain (Production Only)

After deployment, update the URLs in:
- `app/utils/daySharing.ts` (line 51): Change `https://smashbook.app` to your Firebase hosting URL
- `public/day.html` (meta tags): Update with your actual domain

Your Firebase hosting URL will be something like:
`https://smashbook-ae1b0.web.app`

### Step 5: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

This allows the web page to read shared day data without authentication.

## 🎨 Customization

### Change the Preview Image

Edit `public/day.html` line 273:
```javascript
const imageUrl = imagesToShow[0]?.imageUri || 'https://YOUR-DOMAIN/og-image.png';
```

Add a custom `og-image.png` (1200x630px) to the `public/` folder.

### Customize the Landing Page

Edit `public/day.html`:
- Change colors in the `<style>` section
- Modify the layout in the `<body>` section
- Update the Firebase config if needed

### Update App Store Link

In `public/day.html` line 291, update:
```javascript
window.location.href = 'https://apps.apple.com/app/YOUR-APP-ID';
```

## 🔗 How It Works

### 1. User Shares a Day
```typescript
// User taps share button in DayDivider
shareDayViaSheet(userId, dateString, memories, userName)
  → Creates document in Firestore: dayShares/{shareId}
  → Generates link: https://smashbook.app/day/{shareId}
  → Opens native share sheet
```

### 2. Link is Shared
```
iMessage/SMS fetches: https://smashbook.app/day/{shareId}
  → Reads Open Graph meta tags
  → Shows rich preview with image, title, description
```

### 3. Recipient Clicks Link
```
iOS detects: smashbook2://day/{shareId}
  → Opens Smashbook app
  → Routes to: app/(auth)/shared-day/[shareId].tsx
  → Loads day data from Firestore
  → Displays memories
```

### 4. If App Not Installed
```
Browser loads: https://smashbook.app/day/{shareId}
  → day.html fetches data from Firestore
  → Displays photos and info
  → "View in Smashbook" button opens App Store
```

## 📊 Data Structure

### Firestore: `dayShares/{shareId}`
```typescript
{
  userId: string,
  date: "YYYY-MM-DD",
  userName: "Julia",
  memories: [
    {
      id: "memory123",
      type: "photo",
      imageUri: "file:///..."  // Local path or Firebase URL
    }
  ],
  createdAt: Timestamp,
  viewCount: number
}
```

## ⚠️ Current Limitations (Demo Mode)

1. **Images are local** - Shared images use local file paths, so they won't show in the web preview (only in-app)
2. **Domain** - Currently uses placeholder domain `smashbook.app`
3. **App Store link** - Placeholder, needs real App Store URL

## 🎯 Production Checklist

To make this production-ready:

- [ ] Deploy Firebase Hosting
- [ ] Update domain in `daySharing.ts`
- [ ] Create custom OG image (1200x630px)
- [ ] Add real App Store link
- [ ] Set up custom domain (optional)
- [ ] Upload images to Firebase Storage (instead of local) for web previews
- [ ] Configure iOS Universal Links
- [ ] Test on multiple devices/platforms

## 🐛 Troubleshooting

### Share button not appearing
- Check that the day has memories
- Verify user is logged in

### Link doesn't open app
- Deep link scheme is `smashbook2://`
- Check `app.config.ts` has correct `scheme: "smashbook2"`
- On iOS, app must be installed for deep links to work

### Web page shows "not found"
- Verify Firestore rules are deployed
- Check browser console for errors
- Ensure shareId is valid

### Rich preview not showing in texts
- Open Graph tags need to be server-side rendered
- For production, consider using Next.js or a cloud function
- Current setup works best when deployed to Firebase Hosting

## 📱 Testing

1. **Test share flow**: Tap share → Choose Messages → Send
2. **Test deep link**: Tap link in Messages → App opens
3. **Test web fallback**: Open link in Safari → Web page loads
4. **Test preview**: Send to iMessage → Rich preview appears

## 🎉 You're Done!

Your day sharing feature is ready to demo! Just tap that share button and text it to your mom. 📱💙

