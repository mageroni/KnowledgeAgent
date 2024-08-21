import { SearchClient, SearchIndexClient, SearchIndexerClient, type SearchDocumentsResult, type SearchFieldDataType, type SearchIndex, type SearchIndexerDataSourceConnection } from "@azure/search-documents";
import { type ConfluenceRecord } from './Confluence';
const {  AzureKeyCredential } = require("@azure/search-documents");

const dotenv = require("dotenv");
dotenv.config();

const serviceEndpoint = process.env.SEARCH_ENDPOINT || "";
const apiKey = process.env.SEARCH_ADMIN_KEY || "";

const { INDEX_NAME, INDEXER_NAME, STORAGE_ACCOUNT_NAME } = process.env;

class AzureSearchService {

    private searchClient: SearchClient<any>;
    private indexerClient: SearchIndexerClient;
    private indexClient: SearchIndexClient;
    private indexName = INDEX_NAME || "";
    private indexerName = INDEXER_NAME || "";
    private dataSourceName = STORAGE_ACCOUNT_NAME || "";

    constructor() {
        this.indexerClient = new SearchIndexerClient(serviceEndpoint, new AzureKeyCredential(apiKey));
        this.indexClient = new SearchIndexClient(serviceEndpoint, new AzureKeyCredential(apiKey));
        this.searchClient = new SearchClient(serviceEndpoint, this.indexName, new AzureKeyCredential(apiKey));
    }

    async createDataSource() : Promise<void> {
        const dataSource: SearchIndexerDataSourceConnection = {
            name: this.dataSourceName,
            type: "azureblob",
            connectionString: process.env.STORAGE_CONNECTION_STRING,
            container: { name: "confluence-data" }
        };

        await this.indexerClient.createOrUpdateDataSourceConnection(dataSource);
        console.log("Data source connection created");
    }

    async createIndex() : Promise<void> {
        const stringType = "Edm.String" as SearchFieldDataType;
        const complexType = "Edm.ComplexType" as SearchFieldDataType;
        const fields = [
            { name: "id", type: stringType, key: true, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "title", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "spaceId", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "parentId", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "parentType", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "authorId", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "ownerId", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "createdAt", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false },
            { name: "version", type: complexType, fields: [{ name: "createdAt", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false }] },
            { name: "body", type: complexType, fields: [{ name: "storage", type: complexType, fields: [{ name: "value", type: stringType, searchable: true, filterable: true, sortable: true, facetable: false }] }] }
        ];

        const index: SearchIndex = {
            name: this.indexName,
            fields: fields
        };

        await this.indexClient.createIndex(index);
    }

    async createIndexIfNotExists(): Promise<void> {
        try {
            // Check if the index exists
            await this.indexClient.getIndex(this.indexName);
            console.log(`Index ${this.indexName} already exists.`);
        } catch (error) {
            if ((error as RequestException).statusCode  === 404) {
                await this.createIndex();
                console.log(`Index ${this.indexName} created.`);
            } else {
                throw error;
            }
        }
    }

    async createIndexer() : Promise<void> {
        const indexer = {
            name: this.indexerName,
            dataSourceName: this.dataSourceName,
            targetIndexName: this.indexName,
            schedule: { interval: "PT2H" },
            parameters: { configuration: { parsingMode: "jsonArray" as "jsonArray" } }
            //skillsetName: "my-skillset"  // Assuming a skillset is already created
        };

        await this.indexerClient.createIndexer(indexer);
        console.log("Indexer created");
    }

    async createIndexerIfNotExists(): Promise<void> {
        try {
            // Check if the index exists
            await this.indexerClient.getIndexer(this.indexerName);
            await this.indexerClient.runIndexer(this.indexerName);
            console.log(`Indexer ${this.indexerName} already exists. A new run has been triggered.`);
        } catch (error) {
            if ((error as RequestException).statusCode  === 404) {
                await this.createIndexer();
                console.log(`Indexer ${this.indexerName} created.`);
            } else {
                throw error;
            }
        }
    }

    async searchContent(query: string) : Promise<ConfluenceRecord[]> {
        const searchOptions = {
            top: 10
        };
        
        const searchResults = await this.searchClient.search(query, searchOptions);
        const documentsArray: ConfluenceRecord[] = [];

        for await (const result of searchResults.results) {
            console.log(`Found document with id: ${result.document.id}`);
            console.log(result.document);
            documentsArray.push(result.document);
        }

        return documentsArray;
    }

}

interface RequestException extends Error {
    code: string;
    statusCode: number;
    details: {
        error : {
            code: string;
            message: string;
        }
    }
}

export default AzureSearchService;