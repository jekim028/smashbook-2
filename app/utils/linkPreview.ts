export async function getLinkMetadata(url: string): Promise<LinkMetadata> {
  console.log('🔗 Fetching metadata for URL:', url);

  try {
    const queryUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true`;

    console.log('📡 Sending request to Microlink API...');
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('📥 Received response:', JSON.stringify(data, null, 2));

    if (!data || !data.data) {
      console.error('❌ Invalid response structure:', data);
      throw new Error('Invalid response from metadata service');
    }

    const metadata = data.data;

    return {
      title: metadata.title || '',
      description: metadata.description || '',
      image: metadata.image?.url || '',
      url: metadata.url || url,
    };
  } catch (error) {
    console.error('❌ Error fetching link metadata:', error);
    return {
      title: '',
      description: '',
      image: '',
      url,
    };
  }
}
