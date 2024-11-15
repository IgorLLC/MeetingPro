import React from 'react';
import { FileText, CheckSquare } from 'lucide-react';

interface MinutesDisplayProps {
  minutes: {
    topics: Array<{
      title: string;
      keyPoints: string[];
      actionItems: string[];
    }>;
  };
  clientName: string;
  meetingTitle: string;
  date: string;
}

export function MinutesDisplay({ minutes, clientName, meetingTitle, date }: MinutesDisplayProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
      <div className="border-b pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{meetingTitle}</h2>
        <div className="text-gray-600 mt-2">
          <p>Client: {clientName}</p>
          <p>Date: {new Date(date).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="space-y-8">
        {minutes.topics.map((topic, index) => (
          <div key={index} className="border-l-4 border-indigo-500 pl-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {topic.title}
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Key Points</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  {topic.keyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>

              {topic.actionItems.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-green-500" />
                    Action Items
                  </h4>
                  <ul className="list-none space-y-2">
                    {topic.actionItems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-600">
                        <span className="inline-block w-5 h-5 mt-0.5 bg-green-100 text-green-800 rounded-full text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Export to PDF
        </button>
      </div>
    </div>
  );
}