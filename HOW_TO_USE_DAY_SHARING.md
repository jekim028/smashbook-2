# 📤 How to Use Day Sharing Feature

## Quick Demo Guide

### Step 1: Find a Day with Photos
Scroll through your Smashbook feed and find a day that has some photos you want to share.

### Step 2: Tap the Share Button
Look for the **share icon** (📤) on the right side of the date banner. It's next to the date text (e.g., "December 20, 2024").

### Step 3: Choose How to Share
The native iOS share sheet will appear. You can:
- **Messages** - Text it to someone
- **Mail** - Email the link
- **Copy** - Copy the link to clipboard
- Any other sharing option

### Step 4: Send to Your Mom (or Anyone!)
1. Choose "Messages"
2. Select your mom's contact
3. The message will include:
   - A link: `https://smashbook.app/day/[unique-id]`
   - Text: "Check out my Smashbook day from [date]!"
4. Send it!

### Step 5: What She Sees
When your mom receives the text:
- **Rich Preview**: She'll see "View my Smashbook" with the date
- **Preview Image**: The first photo from that day (once Firebase hosting is set up)
- **Tap to Open**: Tapping the link will:
  - Open the Smashbook app (if she has it installed)
  - Open a web page with all your photos (if she doesn't have the app)

## 🎯 What's Included in the Share

When you share a day, the link includes:
- ✅ All photos from that day
- ✅ The date and any title/caption you added
- ✅ Your name (from your Firebase auth profile)
- ✅ Up to 10 images (for preview purposes)

## ⚡️ Current Status (Demo Mode)

### ✅ What Works Now
- Share button appears on all date banners with photos
- Creates shareable links
- Opens native share sheet
- Stores share data in Firestore
- Deep links work to open the app
- In-app viewing of shared days

### ⚠️ What Needs Production Setup
- **Rich text previews**: Need Firebase Hosting deployed (see SHARE_FEATURE_SETUP.md)
- **Preview images**: Currently uses local file paths (need to upload to Firebase Storage for web viewing)
- **Custom domain**: Currently using placeholder `smashbook.app`

## 🧪 Testing Tips

### Test 1: Share to Yourself
1. Tap share on a day
2. Choose "Messages"
3. Send to yourself
4. Tap the link in Messages
5. **Expected**: App opens and shows that day

### Test 2: Share to Notes
1. Tap share on a day
2. Choose "Notes"
3. Create a new note with the link
4. Copy the link from Notes
5. Paste it in Safari
6. **Expected**: Opens the shared day web page

### Test 3: Copy Link
1. Tap share on a day
2. Choose "Copy"
3. Paste the link anywhere (Messages, Notes, etc.)
4. **Link format**: `https://smashbook.app/day/ABC123xyz`

## 📊 Behind the Scenes

Each time you share a day:
1. App creates a document in Firestore (`dayShares` collection)
2. Stores: date, your name, memory IDs, preview images
3. Generates a unique share ID
4. Creates link: `https://smashbook.app/day/{shareId}`
5. Opens native share sheet
6. When someone views it, increments view count

## 🎨 Customization

Want to change what the share looks like?
- Edit: `app/utils/daySharing.ts` (line 79-86) - Message format
- Edit: `public/day.html` - Web page design
- Add custom Open Graph image: `public/og-image.png` (1200x630px)

## 🚀 Next Steps for Production

1. **Deploy Firebase Hosting**
   ```bash
   firebase deploy --only hosting
   ```

2. **Upload Images to Cloud**
   - Modify `AddMediaModal.tsx` to upload to Firebase Storage
   - Update share extension to upload to cloud
   - This makes images visible in web previews

3. **Get Custom Domain** (optional)
   - Set up `smashbook.app` or your own domain
   - Configure Firebase Hosting custom domain
   - Update URLs in code

4. **Add App Store Link**
   - Update `public/day.html` with real App Store URL
   - Add "Get Smashbook" button for non-users

## ❓ Troubleshooting

**Share button not showing?**
- Make sure the day has at least one photo
- Check that you're logged in

**Link doesn't open the app?**
- Make sure the app is installed
- Check that the link format is correct: `smashbook2://day/...`

**Can't see shared photos on web?**
- Images are stored locally, not yet uploaded to cloud
- For web viewing, need to deploy Firebase Hosting and upload images

**"Share not found" error?**
- Check internet connection
- Verify Firestore rules are deployed
- Make sure the share link is complete

## 💡 Pro Tips

- Share days with the best photos for better previews
- Add titles/captions to days before sharing (makes them more personal)
- Share multiple days by copying links and sending together
- Check view counts in Firestore to see engagement

## 🎉 You're Ready!

The day sharing feature is fully functional in the app right now. Just tap that share button and send it to your mom! 📱💙

For full production deployment with rich previews, follow the steps in `SHARE_FEATURE_SETUP.md`.

