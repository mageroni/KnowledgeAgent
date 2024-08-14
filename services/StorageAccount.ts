import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient } from '@azure/storage-blob';
import * as dotenv from 'dotenv';

dotenv.config();

class StorageAccountService {
  private blobServiceClient: BlobServiceClient;

  constructor(accountName: string, accountKey: string) {
    if (!accountName) throw new Error('Azure Storage account name not found');
    if (!accountKey) throw new Error('Azure Storage account key not found');

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    this.blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
  }

  async createContainer(containerName: string): Promise<ContainerClient> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    return containerClient;
  }

  async containerExists(containerName: string): Promise<boolean> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    return containerClient.exists();
  }

  //get file with latest timestamp in the container. Return the timestamp value
  async getLatestTimestamp(containerName: string): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobs = containerClient.listBlobsFlat();
    let latestTimestamp = '';
    for await (const blob of blobs) {
      const parts = blob.name.split('_', 2);
      if (parts.length === 2) {
        const timestamp = parts[1].replace('.json', '');
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
        }
      }
    }
    return latestTimestamp;
  }

  async uploadJsonData(containerName: string, blobName: string, data: object[]): Promise<void> {
    const containerClient = await this.createContainer(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const dataBuffer = Buffer.from(JSON.stringify(data));
    await blockBlobClient.uploadData(dataBuffer);
  }
}

export default StorageAccountService;