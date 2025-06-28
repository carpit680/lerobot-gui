import React, { useState, useEffect } from 'react'
import { useLeRobotStore } from '../store/lerobotStore'
import { toast } from 'react-hot-toast'
import {
  ChartBarIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface Dataset {
  id: string;
  name: string;
  full_name: string;
  author: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  last_modified: string;
  last_modified_formatted: string;
  created_at: string;
  created_at_formatted: string;
  size: number;
  size_formatted: string;
  card_data: any;
  is_owner: boolean;
}

interface DatasetDetails extends Dataset {
  siblings: any[];
  configs: string[];
  default_config: string;
  citation: string;
  homepage: string;
  license: string;
  paper_id: string;
  sha: string;
  private: boolean;
}

export default function DatasetVisualization() {
  const { hfUser, hfToken } = useLeRobotStore()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDatasets = async (query?: string) => {
    if (!hfUser) {
      setError('Hugging Face username not found. Please configure it in Arm Configuration.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:8000/dataset-visualization/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: hfUser,
          token: hfToken || undefined,
          search_query: query || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setDatasets(data.datasets)
        if (data.count === 0) {
          setError(`No datasets found for user ${hfUser}${query ? ` matching "${query}"` : ''}`)
        }
      } else {
        setError(data.detail || 'Failed to fetch datasets')
      }
    } catch (err) {
      setError('Network error while fetching datasets')
      console.error('Error fetching datasets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchDatasets(searchQuery)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    fetchDatasets()
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const getCleanDescription = (description: string): string => {
    if (!description) return 'No description available'
    
    // Split by common separators that indicate detailed info is coming
    const separators = [
      '\n\n\t\n\t\t\n\t\tDataset Structure',
      '\n\nDataset Structure',
      '\n\n\t\n\t\t\n\t\t',
      '\n\n\t\t\n\t\t',
      '\n\n\t\n\t\t',
      '\n\n\t\t',
      '\n\nSee the full description',
      '\n\nFor more information',
      '\n\nAdditional information'
    ]
    
    let cleanDesc = description
    for (const separator of separators) {
      const parts = cleanDesc.split(separator)
      if (parts.length > 1) {
        cleanDesc = parts[0].trim()
        break
      }
    }
    
    // Remove any trailing dots or ellipsis
    cleanDesc = cleanDesc.replace(/\.{2,}$/, '')
    
    // Truncate if too long (max 150 characters)
    if (cleanDesc.length > 150) {
      cleanDesc = cleanDesc.substring(0, 147) + '...'
    }
    
    return cleanDesc || 'No description available'
  }

  useEffect(() => {
    if (hfUser) {
      fetchDatasets()
    }
  }, [hfUser])

  if (!hfUser) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Hugging Face Username Required
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Please configure your Hugging Face username in the Arm Configuration page to view your datasets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dataset Visualization</h1>
        <p className="text-gray-600">
          View and explore your datasets from Hugging Face
        </p>
        <div className="mt-2 text-sm text-gray-500">
          User: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{hfUser}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading datasets...</span>
        </div>
      )}

      {/* Datasets Grid */}
      {!loading && datasets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {datasets
            .filter(dataset => dataset.tags.includes('LeRobot'))
            .map((dataset) => (
              <div
                key={dataset.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {dataset.name}
                    </h3>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">📅 {dataset.last_modified_formatted}</span>
                  </div>
                  
                  {dataset.size_formatted && (
                    <div className="text-sm text-gray-500 mb-3">
                      Size: {dataset.size_formatted}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{formatNumber(dataset.downloads)} downloads</span>
                    <span>{formatNumber(dataset.likes)} likes</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <a
                      href={`https://huggingface.co/spaces/lerobot/visualize_dataset?path=%2F${dataset.author}%2F${dataset.name}%2Fepisode_0`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 text-center"
                    >
                      Visualize
                    </a>
                    <a
                      href={`https://huggingface.co/datasets/${dataset.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 text-center"
                    >
                      Open
                    </a>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* No Datasets */}
      {!loading && datasets.length === 0 && !error && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No datasets found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first dataset.
          </p>
        </div>
      )}
    </div>
  )
} 