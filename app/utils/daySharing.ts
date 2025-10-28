import { Share } from 'react-native';

/**
 * SIMPLEST POSSIBLE IMPLEMENTATION
 * Just shares a text message with a date-specific deep link that opens the app
 */
export const shareDayViaSheet = async (
  dateString: string,
  dayTitle?: string,
  dayCaption?: string
): Promise<void> => {
  try {
    console.log('[DaySharing] Sharing day:', dateString);
    
    // Format the date nicely for display
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Create a date-specific looking deep link (still opens to home)
    // Format: smashbook2://day/2025-10-22
    const deepLink = `smashbook2://day/${dateString}`;
    
    // Build the message
    const title = dayTitle || formattedDate;
    let message = `Check out my Smashbook: ${title}`;
    
    if (dayCaption) {
      message += `\n\n${dayCaption}`;
    }
    
    message += `\n\n${deepLink}`;
    
    // Share ONLY the text message (no URL parameter to avoid image preview)
    await Share.share({
      message
    });
    
    console.log('[DaySharing] Share sheet opened');
  } catch (error: any) {
    // User cancelled - not an error
    if (error.message !== 'User did not share') {
      console.error('[DaySharing] Error sharing:', error);
      throw error;
    }
  }
};

