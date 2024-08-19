import { SearchClient, SearchIndexClient, SearchIndexerClient, type SearchDocumentsResult, type SearchFieldDataType, type SearchIndex, type SearchIndexerDataSourceConnection } from "@azure/search-documents";
import { type ConfluenceRecord } from './Confluence';
const {  AzureKeyCredential } = require("@azure/search-documents");

const dotenv = require("dotenv");
dotenv.config();

const serviceEndpoint = process.env.SEARCH_ENDPOINT || "";
const apiKey = process.env.SEARCH_ADMIN_KEY || "";

class AzureSearchService {

    private searchClient: SearchClient<any>;
    private indexerClient: SearchIndexerClient;
    private indexClient: SearchIndexClient;

    constructor() {
        this.indexerClient = new SearchIndexerClient(serviceEndpoint, new AzureKeyCredential(apiKey));
        this.indexClient = new SearchIndexClient(serviceEndpoint, new AzureKeyCredential(apiKey));
        this.searchClient = new SearchClient(serviceEndpoint, "my-index", new AzureKeyCredential(apiKey));
    }

    async createDataSource() : Promise<void> {
        const dataSource: SearchIndexerDataSourceConnection = {
            name: "my-datasource",
            type: "azureblob",
            connectionString: process.env.STORAGE_CONNECTION_STRING,
            container: { name: "mageroni" }
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
            name: "my-index",
            fields: fields
        };

        await this.indexClient.createIndex(index);
        console.log("Index created");
    }

    async createIndexer() : Promise<void> {
        const indexer = {
            name: "my-indexer",
            dataSourceName: "my-datasource",
            targetIndexName: "my-index",
            schedule: { interval: "PT2H" },
            parameters: { configuration: { parsingMode: "jsonArray" as "jsonArray" } }
            //skillsetName: "my-skillset"  // Assuming a skillset is already created
        };

        await this.indexerClient.createIndexer(indexer);
        console.log("Indexer created");
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

export default AzureSearchService;