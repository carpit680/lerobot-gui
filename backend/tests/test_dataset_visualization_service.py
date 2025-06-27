import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from backend.dataset_visualization_service import DatasetVisualizationService

@pytest.fixture
def service():
    return DatasetVisualizationService()

@pytest.fixture
def mock_datasets():
    return [
        {
            "id": "test-user/dataset1",
            "author": "test-user",
            "description": "Test dataset 1",
            "downloads": 1000,
            "likes": 50,
            "tags": ["test", "robotics"],
            "lastModified": "2024-01-01T00:00:00Z",
            "createdAt": "2024-01-01T00:00:00Z",
            "size": 1024 * 1024,  # 1MB
            "cardData": {},
        },
        {
            "id": "test-user/dataset2",
            "author": "test-user",
            "description": "Test dataset 2",
            "downloads": 500,
            "likes": 25,
            "tags": ["test"],
            "lastModified": "2024-01-02T00:00:00Z",
            "createdAt": "2024-01-02T00:00:00Z",
            "size": 2048 * 1024,  # 2MB
            "cardData": {},
        }
    ]

@pytest.fixture
def mock_dataset_details():
    return {
        "id": "test-user/dataset1",
        "author": "test-user",
        "description": "Test dataset 1",
        "downloads": 1000,
        "likes": 50,
        "tags": ["test", "robotics"],
        "lastModified": "2024-01-01T00:00:00Z",
        "createdAt": "2024-01-01T00:00:00Z",
        "size": 1024 * 1024,
        "cardData": {},
        "siblings": [],
        "configs": ["default"],
        "defaultConfig": "default",
        "citation": "Test citation",
        "homepage": "https://example.com",
        "license": "MIT",
        "paperId": "test-paper",
        "sha": "abc123",
        "private": False
    }

class TestDatasetVisualizationService:
    
    @pytest.mark.asyncio
    async def test_get_user_datasets_success(self, service, mock_datasets):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_datasets
            mock_get.return_value = mock_response
            
            result = await service.get_user_datasets("test-user")
            
            assert len(result) == 2
            assert result[0]["id"] == "test-user/dataset1"
            assert result[0]["name"] == "dataset1"
            assert result[0]["author"] == "test-user"
            assert result[0]["downloads"] == 1000
            assert result[0]["is_owner"] == True
            assert result[0]["size_formatted"] == "1.0 MB"
    
    @pytest.mark.asyncio
    async def test_get_user_datasets_with_token(self, service, mock_datasets):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_datasets
            mock_get.return_value = mock_response
            
            result = await service.get_user_datasets("test-user", "test-token")
            
            # Check that the token was used in headers
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            assert call_args[1]['headers']['Authorization'] == 'Bearer test-token'
    
    @pytest.mark.asyncio
    async def test_get_user_datasets_api_error(self, service):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 404
            mock_get.return_value = mock_response
            
            result = await service.get_user_datasets("test-user")
            
            assert result == []
    
    @pytest.mark.asyncio
    async def test_get_user_datasets_exception(self, service):
        with patch('requests.get') as mock_get:
            mock_get.side_effect = Exception("Network error")
            
            result = await service.get_user_datasets("test-user")
            
            assert result == []
    
    @pytest.mark.asyncio
    async def test_get_dataset_details_success(self, service, mock_dataset_details):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_dataset_details
            mock_get.return_value = mock_response
            
            result = await service.get_dataset_details("test-user/dataset1")
            
            assert result is not None
            assert result["id"] == "test-user/dataset1"
            assert result["name"] == "dataset1"
            assert result["author"] == "test-user"
            assert result["license"] == "MIT"
            assert result["private"] == False
            assert result["size_formatted"] == "1.0 MB"
    
    @pytest.mark.asyncio
    async def test_get_dataset_details_not_found(self, service):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 404
            mock_get.return_value = mock_response
            
            result = await service.get_dataset_details("test-user/nonexistent")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_search_datasets_success(self, service, mock_datasets):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_datasets
            mock_get.return_value = mock_response
            
            result = await service.search_datasets("test", "test-user")
            
            assert len(result) == 2
            # Check that the search URL was constructed correctly
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            assert "search=test" in call_args[0][0]
            assert "author=test-user" in call_args[0][0]
    
    @pytest.mark.asyncio
    async def test_search_datasets_without_username(self, service, mock_datasets):
        with patch('requests.get') as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_datasets
            mock_get.return_value = mock_response
            
            result = await service.search_datasets("test")
            
            assert len(result) == 2
            # Check that the search URL was constructed correctly without author filter
            mock_get.assert_called_once()
            call_args = mock_get.call_args
            assert "search=test" in call_args[0][0]
            assert "author=" not in call_args[0][0]
    
    def test_format_size(self, service):
        assert service._format_size(0) == "0 B"
        assert service._format_size(1024) == "1.0 KB"
        assert service._format_size(1024 * 1024) == "1.0 MB"
        assert service._format_size(1024 * 1024 * 1024) == "1.0 GB"
        assert service._format_size(1024 * 1024 * 1024 * 1024) == "1.0 TB"
    
    def test_process_datasets(self, service, mock_datasets):
        result = service._process_datasets(mock_datasets, "test-user")
        
        assert len(result) == 2
        assert result[0]["id"] == "test-user/dataset1"
        assert result[0]["name"] == "dataset1"
        assert result[0]["full_name"] == "test-user/dataset1"
        assert result[0]["is_owner"] == True
        assert result[0]["size_formatted"] == "1.0 MB"
        assert "last_modified_formatted" in result[0]
        assert "created_at_formatted" in result[0]
    
    def test_process_datasets_not_owner(self, service, mock_datasets):
        result = service._process_datasets(mock_datasets, "other-user")
        
        assert len(result) == 2
        assert result[0]["is_owner"] == False
    
    def test_process_dataset_details(self, service, mock_dataset_details):
        result = service._process_dataset_details(mock_dataset_details)
        
        assert result["id"] == "test-user/dataset1"
        assert result["name"] == "dataset1"
        assert result["license"] == "MIT"
        assert result["private"] == False
        assert result["size_formatted"] == "1.0 MB"
        assert "last_modified_formatted" in result
        assert "created_at_formatted" in result
    
    def test_process_dataset_details_exception(self, service):
        # Test with malformed data
        malformed_data = {"id": "test", "size": "invalid"}
        result = service._process_dataset_details(malformed_data)
        
        # Should return empty dict on error
        assert result == {} 