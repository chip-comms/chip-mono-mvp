'use client';

import React, { useState } from 'react';
import {
  FileText,
  CheckSquare,
  BarChart3,
  MessageSquare,
  TrendingUp,
  User,
  Clock,
  Target,
  Download,
  Copy,
} from 'lucide-react';
import {
  Intelligence,
  ActionItem,
  CompanyValue,
  SpeakerStats,
} from '@/lib/types';

interface IntelligenceViewerProps {
  intelligence: Intelligence;
  recordingTitle: string;
}

type Tab = 'summary' | 'transcript' | 'actions' | 'metrics' | 'topics';

export default function IntelligenceViewer({
  intelligence,
  recordingTitle,
}: IntelligenceViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const tabs = [
    { id: 'summary' as Tab, label: 'Summary', icon: FileText },
    { id: 'transcript' as Tab, label: 'Transcript', icon: MessageSquare },
    { id: 'actions' as Tab, label: 'Action Items', icon: CheckSquare },
    { id: 'metrics' as Tab, label: 'Communication', icon: BarChart3 },
    { id: 'topics' as Tab, label: 'Topics & Sentiment', icon: TrendingUp },
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const downloadTranscript = () => {
    const blob = new Blob([intelligence.transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recordingTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded border ${colors[priority as keyof typeof colors] || colors.medium}`}
      >
        {priority.toUpperCase()}
      </span>
    );
  };

  const renderSummaryTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-blue-900">
            Meeting Summary
          </h3>
          <button
            onClick={() => copyToClipboard(intelligence.summary, 'Summary')}
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>{copiedText === 'Summary' ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
        <p className="text-gray-700 leading-relaxed">{intelligence.summary}</p>
      </div>

      {intelligence.insights && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">
            Key Insights
          </h3>
          <p className="text-gray-700 leading-relaxed">
            {intelligence.insights}
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {intelligence.actionItems.length}
          </div>
          <div className="text-sm text-gray-600">Action Items</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {intelligence.keyTopics.length}
          </div>
          <div className="text-sm text-gray-600">Topics</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {intelligence.speakerStats.length}
          </div>
          <div className="text-sm text-gray-600">Speakers</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(intelligence.sentiment.score * 100)}%
          </div>
          <div className="text-sm text-gray-600">Positive Sentiment</div>
        </div>
      </div>
    </div>
  );

  const renderTranscriptTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Full Transcript</h3>
        <div className="flex space-x-2">
          <button
            onClick={() =>
              copyToClipboard(intelligence.transcript, 'Transcript')
            }
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>{copiedText === 'Transcript' ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={downloadTranscript}
            className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-50 border rounded-lg p-6 max-h-96 overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
          {intelligence.transcript}
        </pre>
      </div>
    </div>
  );

  const renderActionsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Action Items</h3>
        <div className="text-sm text-gray-600">
          {intelligence.actionItems.length} items
        </div>
      </div>

      {intelligence.actionItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No action items identified in this meeting</p>
        </div>
      ) : (
        <div className="space-y-3">
          {intelligence.actionItems.map((item: ActionItem, index: number) => (
            <div
              key={index}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-gray-800 mb-2">{item.text}</p>
                  {item.assignee && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      <span>Assigned to: {item.assignee}</span>
                    </div>
                  )}
                </div>
                <div className="ml-4">{renderPriorityBadge(item.priority)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMetricsTab = () => (
    <div className="space-y-6">
      {/* Talk Time */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Speaking Time Distribution
        </h4>
        <div className="space-y-3">
          {intelligence.speakerStats.map(
            (speaker: SpeakerStats, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{speaker.name}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600">
                    {Math.round(speaker.duration / 60)}m {speaker.duration % 60}
                    s
                  </div>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${speaker.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-sm font-medium w-12 text-right">
                    {speaker.percentage}%
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Response Delays */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Response Patterns
        </h4>
        {intelligence.communicationMetrics.responseDelays.length === 0 ? (
          <p className="text-gray-500">No response delay data available</p>
        ) : (
          <div className="space-y-3">
            {intelligence.communicationMetrics.responseDelays.map(
              (delay, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span>After {delay.afterSpeaker}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        delay.delaySeconds < 0
                          ? 'bg-red-100 text-red-700'
                          : delay.delaySeconds < 1
                            ? 'bg-green-100 text-green-700'
                            : delay.delaySeconds < 3
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {delay.delaySeconds < 0
                        ? 'Interrupted'
                        : `${delay.delaySeconds.toFixed(1)}s delay`}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Company Values */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Company Values Alignment
        </h4>
        <div className="space-y-4">
          {intelligence.communicationMetrics.companyValuesAlignment.values.map(
            (value: CompanyValue, index: number) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{value.value}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(value.score * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      value.score >= 0.8
                        ? 'bg-green-600'
                        : value.score >= 0.6
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                    }`}
                    style={{ width: `${value.score * 100}%` }}
                  ></div>
                </div>
                {value.examples.length > 0 && (
                  <div className="pl-7">
                    <div className="text-xs text-gray-600 font-medium mb-1">
                      Examples:
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {value.examples.slice(0, 2).map((example, i) => (
                        <li
                          key={i}
                          className="before:content-['•'] before:mr-2"
                        >
                          &quot;{example}&quot;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {intelligence.communicationMetrics.companyValuesAlignment.insights && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Insight:</strong>{' '}
              {
                intelligence.communicationMetrics.companyValuesAlignment
                  .insights
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTopicsTab = () => (
    <div className="space-y-6">
      {/* Sentiment */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Overall Sentiment
        </h4>
        <div className="flex items-center space-x-4">
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              intelligence.sentiment.overall === 'positive'
                ? 'bg-green-100 text-green-700'
                : intelligence.sentiment.overall === 'negative'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {intelligence.sentiment.overall.toUpperCase()}
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                intelligence.sentiment.overall === 'positive'
                  ? 'bg-green-600'
                  : intelligence.sentiment.overall === 'negative'
                    ? 'bg-red-600'
                    : 'bg-gray-600'
              }`}
              style={{
                width: `${Math.abs(intelligence.sentiment.score) * 100}%`,
              }}
            ></div>
          </div>
          <span className="text-sm font-medium">
            {Math.round(intelligence.sentiment.score * 100)}%
          </span>
        </div>
      </div>

      {/* Key Topics */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Key Topics Discussed
        </h4>
        {intelligence.keyTopics.length === 0 ? (
          <p className="text-gray-500">No key topics identified</p>
        ) : (
          <div className="space-y-3">
            {intelligence.keyTopics
              .sort((a, b) => b.relevance - a.relevance)
              .map((topic, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{topic.topic}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${topic.relevance * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {Math.round(topic.relevance * 100)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b bg-gray-50">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'summary' && renderSummaryTab()}
        {activeTab === 'transcript' && renderTranscriptTab()}
        {activeTab === 'actions' && renderActionsTab()}
        {activeTab === 'metrics' && renderMetricsTab()}
        {activeTab === 'topics' && renderTopicsTab()}
      </div>
    </div>
  );
}
