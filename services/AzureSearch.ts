import { SearchClient, SearchIndexClient, SearchIndexerClient, type SearchFieldDataType, type SearchIndex, type SearchIndexerDataSourceConnection } from "@azure/search-documents";

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
            parameter: { configuration: { parsingMode: "jsonArray" } },
            fieldMappings: [
                { sourceFieldName: "id", targetFieldName: "id" },
                { sourceFieldName: "title", targetFieldName: "title" },
                { sourceFieldName: "spaceId", targetFieldName: "spaceId" },
                { sourceFieldName: "parentId", targetFieldName: "parentId" },
                { sourceFieldName: "parentType", targetFieldName: "parentType" },
                { sourceFieldName: "authorId", targetFieldName: "authorId" },
                { sourceFieldName: "ownerId", targetFieldName: "ownerId" },
                { sourceFieldName: "createdAt", targetFieldName: "createdAt" }/*,
                { sourceFieldName: "/content/version/createdAt", targetFieldName: "version/createdAt" },
                { sourceFieldName: "/content/body/storage/value", targetFieldName: "body/storage/value" }*/
            ]
            //skillsetName: "my-skillset"  // Assuming a skillset is already created
        };

        await this.indexerClient.createIndexer(indexer);
        console.log("Indexer created");
    }

    async searchContent(query: string) : Promise<void> {
        const searchResults = await this.searchClient.search(query);

        for await (const result of searchResults.results) {
            console.log(`Found document with id: ${result.document.id}`);
            console.log(result.document);
        }
    }

}

export default AzureSearchService;