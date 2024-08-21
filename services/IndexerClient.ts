import StorageAccount from './StorageAccount';
import AzureSearchService from "./AzureSearch";
import { getConfluenceContent } from './Confluence';

class IndexerClient {

    private isIndexing : boolean;
    private containerName = 'confluence-data';

    constructor() {
        this.isIndexing = false
    }

    async getIndexingStatusMessage() {
        if(this.isIndexing){
            return {
                "id": "chatcmpl-123",
                "object": "chat.completion.chunk",
                "created": (new Date()).getTime(),
                "model": "gpt-4-1106-preview",
                "system_fingerprint": "fp_44709d6fcb",
                "choices": [
                    {
                        "index": 0,
                        "delta": {
                            "content": "Indexing is still in progress. Please wait for a while and try again.",
                        },
                        "logprobs": null,
                        "finish_reason": null
                    }
                ]
            };
        }
        return null;
    }

    async startIndexing() {
        if(this.isIndexing === false) {
          this.isIndexing = true;
          try {
            const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;
            const storageAccountKey = process.env.STORAGE_ACCOUNT_KEY;
      
            if (!storageAccountName || !storageAccountKey) {
              throw new Error('Storage account name or key is missing in environment variables');
            }
      
            const storageAccount = new StorageAccount(storageAccountName, storageAccountKey);
            
            let confluenceData;
            if(await storageAccount.containerExists(this.containerName)) {
              const latestTimestamp = await storageAccount.getLatestTimestamp(this.containerName);
              confluenceData = await getConfluenceContent(true, latestTimestamp);
            }else{
              await storageAccount.createContainer(this.containerName);
              confluenceData = await getConfluenceContent(false, '');
            }
      
            const timestampNow = new Date().toISOString();
            storageAccount.uploadJsonData(this.containerName, `${this.containerName}_${timestampNow}.json`, confluenceData);
      
            // Call Azure Search Service to index the data
            const azureSearchService = new AzureSearchService();
            await azureSearchService.createDataSource();
            await azureSearchService.createIndexIfNotExists();
            await azureSearchService.createIndexerIfNotExists();
            
          } catch (error) {
            console.error('Error during indexing:', error);
          } finally {
            this.isIndexing = false;
          }
        }
    }
}

export default IndexerClient;