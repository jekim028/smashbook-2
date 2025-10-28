export interface LinkMetadata {
  title: string;
  description: string;
  image: string;
  url: string;
  publisher?: string;
}

// Instagram-specific handler
async function getInstagramMetadata(url: string): Promise<LinkMetadata> {
  // For Instagram, use Microlink API which can handle it better
  try {
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=true`;
    const response = await fetch(microlinkUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('Instagram Microlink failed:', response.status);
      throw new Error('Microlink request failed');
    }
    
    const data = await response.json();
    console.log('Instagram metadata received:', JSON.stringify(data, null, 2));
    
    if (data?.data) {
      const metadata = data.data;
      
      // Try multiple image sources - prioritize actual images over screenshots
      let imageUrl = '';
      if (metadata.image?.url) {
        imageUrl = metadata.image.url;
      } else if (metadata.logo?.url) {
        imageUrl = metadata.logo.url;
      } else if (metadata.screenshot?.url) {
        imageUrl = metadata.screenshot.url;
      }
      
      const result = {
        title: metadata.title || 'Instagram Post',
        description: metadata.description || '',
        image: imageUrl,
        url: url,
        publisher: metadata.publisher || 'Instagram',
      };
      
      console.log('Returning Instagram metadata:', result);
      return result;
    }
    
    throw new Error('Invalid Microlink response');
  } catch (error) {
    console.log('Instagram metadata error:', error);
    // Last resort for Instagram
    return {
      title: 'Instagram Post',
      description: 'View on Instagram',
      image: '',
      url: url,
      publisher: 'Instagram',
    };
  }
}

// Direct Open Graph parser as fallback
async function parseOpenGraphDirect(url: string): Promise<LinkMetadata> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      },
    });
    
    const html = await response.text();
    
    // Extract Open Graph tags
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1];
    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1];
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1];
    const ogSiteName = html.match(/<meta\s+property="og:site_name"\s+content="([^"]*)"/i)?.[1];
    
    // Also try Twitter Card tags
    const twitterTitle = html.match(/<meta\s+name="twitter:title"\s+content="([^"]*)"/i)?.[1];
    const twitterDescription = html.match(/<meta\s+name="twitter:description"\s+content="([^"]*)"/i)?.[1];
    const twitterImage = html.match(/<meta\s+name="twitter:image"\s+content="([^"]*)"/i)?.[1];
    
    // Try standard meta description
    const metaDescription = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
    
    // Try title tag
    const pageTitle = html.match(/<title>([^<]*)<\/title>/i)?.[1];
    
    const title = ogTitle || twitterTitle || pageTitle || 'Article';
    const description = ogDescription || twitterDescription || metaDescription || '';
    const image = ogImage || twitterImage || '';
    const publisher = ogSiteName || new URL(url).hostname;
    
    return {
      title,
      description,
      image,
      url,
      publisher,
    };
  } catch (error) {
    throw error;
  }
}

export async function getLinkMetadata(url: string): Promise<LinkMetadata> {
  // Check if it's an Instagram URL - use Microlink directly (skip direct parsing)
  if (url.includes('instagram.com/reel/') || url.includes('instagram.com/p/') || url.includes('instagram.com/tv/')) {
    return getInstagramMetadata(url);
  }

  try {
    // Try direct Open Graph parsing FIRST (more reliable, no rate limits)
    const directResult = await parseOpenGraphDirect(url);
    
    if (directResult.title && directResult.title !== 'Article') {
      // If no image from direct parsing, try to get screenshot from Microlink
      if (!directResult.image) {
        try {
          const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`;
          const screenshotResponse = await fetch(screenshotUrl, { timeout: 5000 } as any);
          const screenshotData = await screenshotResponse.json();
          
          if (screenshotData?.data?.screenshot?.url) {
            directResult.image = screenshotData.data.screenshot.url;
          }
        } catch (screenshotError) {
          // Continue without image
        }
      }
      
      return directResult;
    }
    
    throw new Error('Direct parsing did not return valid metadata');
  } catch (directError) {
    
    // Fallback to Microlink API
    try {
      const queryUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&screenshot=true&embed=screenshot.url`;

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Microlink API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.data) {
        throw new Error('Invalid response from Microlink');
      }

      const metadata = data.data;

      // Try multiple image sources
      let imageUrl = '';
      
      if (metadata.image?.url) {
        imageUrl = metadata.image.url;
      } else if (metadata.screenshot?.url) {
        imageUrl = metadata.screenshot.url;
      } else if (metadata.logo?.url) {
        imageUrl = metadata.logo.url;
      } else if (metadata.favicon) {
        imageUrl = metadata.favicon;
      }

      const result = {
        title: metadata.title || metadata.publisher || new URL(url).hostname,
        description: metadata.description || '',
        image: imageUrl,
        url: metadata.url || url,
        publisher: metadata.publisher || '',
      };

      return result;
    } catch (microlinkError) {
      
      // Last resort: return basic info
      return {
        title: new URL(url).hostname,
        description: '',
        image: '',
        url,
        publisher: new URL(url).hostname,
      };
    }
  }
}
