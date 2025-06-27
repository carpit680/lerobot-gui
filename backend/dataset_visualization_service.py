import requests
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class DatasetVisualizationService:
    def __init__(self):
        self.base_url = "https://huggingface.co/api"
        
    async def get_user_datasets(self, username: str, token: Optional[str] = None) -> List[Dict]:
        """
        Fetch all datasets for a given user from Hugging Face API
        """
        try:
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            
            # Fetch datasets from the user's profile
            url = f"{self.base_url}/datasets?author={username}&sort=downloads&direction=-1"
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                datasets = response.json()
                logger.info(f"Successfully fetched {len(datasets)} datasets for user {username}")
                return self._process_datasets(datasets, username)
            else:
                logger.error(f"Failed to fetch datasets for {username}: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching datasets for {username}: {e}")
            return []
    
    async def get_dataset_details(self, dataset_id: str, token: Optional[str] = None) -> Optional[Dict]:
        """
        Fetch detailed information about a specific dataset
        """
        try:
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            
            url = f"{self.base_url}/datasets/{dataset_id}"
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                dataset = response.json()
                logger.info(f"Successfully fetched details for dataset {dataset_id}")
                return self._process_dataset_details(dataset)
            else:
                logger.error(f"Failed to fetch dataset details for {dataset_id}: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching dataset details for {dataset_id}: {e}")
            return None
    
    async def search_datasets(self, query: str, username: Optional[str] = None, token: Optional[str] = None) -> List[Dict]:
        """
        Search for datasets with optional user filter
        """
        try:
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            
            # Build search URL
            url = f"{self.base_url}/datasets?search={query}&sort=downloads&direction=-1"
            if username:
                url += f"&author={username}"
            
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                datasets = response.json()
                logger.info(f"Successfully searched datasets with query '{query}': {len(datasets)} results")
                return self._process_datasets(datasets, username)
            else:
                logger.error(f"Failed to search datasets: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error searching datasets: {e}")
            return []
    
    def _process_datasets(self, datasets: List[Dict], username: Optional[str] = None) -> List[Dict]:
        """
        Process and format dataset information
        """
        processed_datasets = []
        
        for dataset in datasets:
            try:
                # Try to get size from different possible field names
                size = None
                if "size" in dataset and dataset["size"]:
                    size = dataset["size"]
                elif "sizeInBytes" in dataset and dataset["sizeInBytes"]:
                    size = dataset["sizeInBytes"]
                elif "size_bytes" in dataset and dataset["size_bytes"]:
                    size = dataset["size_bytes"]
                elif "cardData" in dataset and dataset["cardData"]:
                    card_data = dataset["cardData"]
                    if "size" in card_data and card_data["size"]:
                        size = card_data["size"]
                    elif "sizeInBytes" in card_data and card_data["sizeInBytes"]:
                        size = card_data["sizeInBytes"]
                
                # Try to get size category from tags
                size_category = None
                if "tags" in dataset and dataset["tags"]:
                    for tag in dataset["tags"]:
                        if tag.startswith("size_categories:"):
                            size_category = tag.replace("size_categories:", "")
                            break
                
                processed_dataset = {
                    "id": dataset.get("id", ""),
                    "name": dataset.get("id", "").split("/")[-1] if "/" in dataset.get("id", "") else dataset.get("id", ""),
                    "full_name": dataset.get("id", ""),
                    "author": dataset.get("author", ""),
                    "description": dataset.get("description", ""),
                    "downloads": dataset.get("downloads", 0),
                    "likes": dataset.get("likes", 0),
                    "tags": dataset.get("tags", []),
                    "last_modified": dataset.get("lastModified", ""),
                    "created_at": dataset.get("createdAt", ""),
                    "size": size,
                    "size_category": size_category,
                    "card_data": dataset.get("cardData", {}),
                    "is_owner": username == dataset.get("author", "") if username else False
                }
                
                # Format dates
                if processed_dataset["last_modified"]:
                    try:
                        dt = datetime.fromisoformat(processed_dataset["last_modified"].replace("Z", "+00:00"))
                        processed_dataset["last_modified_formatted"] = dt.strftime("%Y-%m-%d %H:%M")
                    except:
                        processed_dataset["last_modified_formatted"] = processed_dataset["last_modified"]
                
                if processed_dataset["created_at"]:
                    try:
                        dt = datetime.fromisoformat(processed_dataset["created_at"].replace("Z", "+00:00"))
                        processed_dataset["created_at_formatted"] = dt.strftime("%Y-%m-%d %H:%M")
                    except:
                        processed_dataset["created_at_formatted"] = processed_dataset["created_at"]
                
                # Format size - only show if we have actual size data
                if processed_dataset["size"]:
                    try:
                        # Ensure size is an integer
                        size_int = int(processed_dataset["size"])
                        processed_dataset["size_formatted"] = self._format_size(size_int)
                    except (ValueError, TypeError):
                        processed_dataset["size_formatted"] = None
                elif processed_dataset["size_category"]:
                    processed_dataset["size_formatted"] = processed_dataset["size_category"]
                else:
                    processed_dataset["size_formatted"] = None
                
                processed_datasets.append(processed_dataset)
                
            except Exception as e:
                logger.error(f"Error processing dataset {dataset.get('id', 'unknown')}: {e}")
                continue
        
        return processed_datasets
    
    def _process_dataset_details(self, dataset: Dict) -> Dict:
        """
        Process detailed dataset information
        """
        try:
            # Try to get size from different possible field names
            size = None
            if "size" in dataset and dataset["size"]:
                size = dataset["size"]
            elif "sizeInBytes" in dataset and dataset["sizeInBytes"]:
                size = dataset["sizeInBytes"]
            elif "size_bytes" in dataset and dataset["size_bytes"]:
                size = dataset["size_bytes"]
            elif "cardData" in dataset and dataset["cardData"]:
                card_data = dataset["cardData"]
                if "size" in card_data and card_data["size"]:
                    size = card_data["size"]
                elif "sizeInBytes" in card_data and card_data["sizeInBytes"]:
                    size = card_data["sizeInBytes"]
            
            # Try to get size category from tags
            size_category = None
            if "tags" in dataset and dataset["tags"]:
                for tag in dataset["tags"]:
                    if tag.startswith("size_categories:"):
                        size_category = tag.replace("size_categories:", "")
                        break
            
            processed_dataset = {
                "id": dataset.get("id", ""),
                "name": dataset.get("id", "").split("/")[-1] if "/" in dataset.get("id", "") else dataset.get("id", ""),
                "full_name": dataset.get("id", ""),
                "author": dataset.get("author", ""),
                "description": dataset.get("description", ""),
                "downloads": dataset.get("downloads", 0),
                "likes": dataset.get("likes", 0),
                "tags": dataset.get("tags", []),
                "last_modified": dataset.get("lastModified", ""),
                "created_at": dataset.get("createdAt", ""),
                "size": size,
                "size_category": size_category,
                "card_data": dataset.get("cardData", {}),
                "siblings": dataset.get("siblings", []),
                "configs": dataset.get("configs", []),
                "default_config": dataset.get("defaultConfig", ""),
                "citation": dataset.get("citation", ""),
                "homepage": dataset.get("homepage", ""),
                "license": dataset.get("license", ""),
                "paper_id": dataset.get("paperId", ""),
                "sha": dataset.get("sha", ""),
                "private": dataset.get("private", False)
            }
            
            # Format dates
            if processed_dataset["last_modified"]:
                try:
                    dt = datetime.fromisoformat(processed_dataset["last_modified"].replace("Z", "+00:00"))
                    processed_dataset["last_modified_formatted"] = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    processed_dataset["last_modified_formatted"] = processed_dataset["last_modified"]
            
            if processed_dataset["created_at"]:
                try:
                    dt = datetime.fromisoformat(processed_dataset["created_at"].replace("Z", "+00:00"))
                    processed_dataset["created_at_formatted"] = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    processed_dataset["created_at_formatted"] = processed_dataset["created_at"]
            
            # Format size - only show if we have actual size data
            if processed_dataset["size"]:
                try:
                    # Ensure size is an integer
                    size_int = int(processed_dataset["size"])
                    processed_dataset["size_formatted"] = self._format_size(size_int)
                except (ValueError, TypeError):
                    processed_dataset["size_formatted"] = None
            elif processed_dataset["size_category"]:
                processed_dataset["size_formatted"] = processed_dataset["size_category"]
            else:
                processed_dataset["size_formatted"] = None
            
            return processed_dataset
            
        except Exception as e:
            logger.error(f"Error processing dataset details: {e}")
            return {}
    
    def _format_size(self, size_bytes: int) -> str:
        """
        Format file size in human readable format
        """
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB", "TB"]
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_names[i]}"

# Global instance
dataset_visualization_service = DatasetVisualizationService() 