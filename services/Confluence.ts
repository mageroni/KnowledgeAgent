import fetch from 'node-fetch';
import TurndownService from 'turndown';

export interface ConfluenceRecord{
  id: string;
  title: string;
  spaceId: string;
  parentId: string;
  parentType: string;
  authorId: string;
  ownerId: string;
  createdAt: string;
  version: {
    createdAt: string;
  };
  body: {
    storage: {
      value: string;
    };
  };
}

interface ConfluenceResponse {
  results: ConfluenceRecord[];
  _links: {
    next: string;
    base: string;
  };
}

const ConfluenceAuthenticationToken = process.env.CONFLUENCE_TOKEN;

export async function getConfluenceContent(incremental: boolean, timestamp: string): Promise<ConfluenceRecord[]> {
  let url: string | null = 'https://mageroni.atlassian.net/wiki/api/v2/pages?body-format=storage&sort=modified-date';
  const headers = {
    'Authorization': ConfluenceAuthenticationToken || '',
    'Content-Type': 'application/json'
  };
  const allData: ConfluenceResponse[] = [];
  const turndownService = new TurndownService();

  try {
    while (url) {
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`Error fetching Confluence content: ${response.statusText}`);
      }

      const data = (await response.json()) as ConfluenceResponse;
      
      if (incremental) {
        const filteredResults = data.results.filter(result => result.version.createdAt > timestamp);
        if (filteredResults.length > 0) {
          allData.push({ ...data, results: filteredResults });
        }
      } else {
        allData.push(data);
      }

      url = data._links.next ? data._links.base + data._links.next : null;
    }
  } catch (error) {
    console.error('Error fetching Confluence content:', error);
  }

  allData.forEach(page => {
    page.results.forEach(result => {
      if (result.body.storage.value) {
        result.body.storage.value = turndownService.turndown(result.body.storage.value);
      }
    }
    );
  });

  if(allData.length > 0) {
    return allData[0].results;
  }

  return [];
}