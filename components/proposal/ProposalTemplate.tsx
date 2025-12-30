"use client";

import React from "react";
import { StructuredProposal, ProposalSection } from "@/lib/types/proposal";

interface ProposalTemplateProps {
  proposal: StructuredProposal;
  editable?: boolean;
  onContentChange?: (section: string, content: string | string[]) => void;
}

export default function ProposalTemplate({
  proposal,
  editable = false,
  onContentChange,
}: ProposalTemplateProps) {
  const renderSection = (
    title: string,
    section: ProposalSection | undefined,
    sectionKey: string
  ) => {
    if (!section) return null;

    const handleContentChange = (newContent: string | string[]) => {
      if (onContentChange) {
        onContentChange(sectionKey, newContent);
      }
    };

    return (
      <div className="mb-8">
        <h2 className="text-lg font-bold uppercase text-gray-900 mb-2 tracking-wide">
          {title}
        </h2>
        <div className="h-px bg-gray-300 mb-4"></div>
        
        {section.type === "paragraph" && (
          <div className="prose prose-sm max-w-none">
            {editable ? (
              <textarea
                value={typeof section.content === "string" ? section.content : ""}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm leading-relaxed"
                style={{ fontSize: "11pt", lineHeight: "1.2" }}
              />
            ) : (
              <p
                className="text-gray-800 leading-relaxed"
                style={{ fontSize: "11pt", lineHeight: "1.2" }}
              >
                {typeof section.content === "string" ? section.content : ""}
              </p>
            )}
          </div>
        )}

        {section.type === "bullets" && (
          <ul className="list-disc list-inside space-y-2 ml-4">
            {Array.isArray(section.content) ? (
              section.content.map((item, index) => (
                <li
                  key={index}
                  className="text-gray-800 leading-relaxed"
                  style={{ fontSize: "11pt", lineHeight: "1.2" }}
                >
                  {editable ? (
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const newContent = [...section.content as string[]];
                        newContent[index] = e.target.value;
                        handleContentChange(newContent);
                      }}
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  ) : (
                    item
                  )}
                </li>
              ))
            ) : (
              <li
                className="text-gray-800 leading-relaxed"
                style={{ fontSize: "11pt", lineHeight: "1.2" }}
              >
                {section.content}
              </li>
            )}
          </ul>
        )}

        {section.type === "numbered" && (
          <ol className="list-decimal list-inside space-y-2 ml-4">
            {Array.isArray(section.content) ? (
              section.content.map((item, index) => (
                <li
                  key={index}
                  className="text-gray-800 leading-relaxed"
                  style={{ fontSize: "11pt", lineHeight: "1.2" }}
                >
                  {editable ? (
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const newContent = [...section.content as string[]];
                        newContent[index] = e.target.value;
                        handleContentChange(newContent);
                      }}
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  ) : (
                    item
                  )}
                </li>
              ))
            ) : (
              <li
                className="text-gray-800 leading-relaxed"
                style={{ fontSize: "11pt", lineHeight: "1.2" }}
              >
                {section.content}
              </li>
            )}
          </ol>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white p-8 md:p-12" style={{ maxWidth: "8.5in", margin: "0 auto" }}>
      {/* Header */}
      <div className="mb-8 border-b-2 border-gray-300 pb-6">
        {proposal.header.companyLogo && (
          <img
            src={proposal.header.companyLogo}
            alt="Company Logo"
            className="h-16 mb-4"
          />
        )}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {proposal.header.companyName}
            </h1>
            <h2 className="text-xl font-semibold text-gray-700">
              {proposal.header.projectName}
            </h2>
            {proposal.header.projectNumber && (
              <p className="text-sm text-gray-600 mt-1">
                Project Number: {proposal.header.projectNumber}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Proposal Date: {proposal.header.proposalDate}</p>
            {proposal.header.to && <p className="mt-1">To: {proposal.header.to}</p>}
            {proposal.header.preparedBy && (
              <p className="mt-1">Prepared By: {proposal.header.preparedBy}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {renderSection(
          "Project Overview",
          proposal.sections.projectOverview,
          "projectOverview"
        )}
        {renderSection(
          "Scope of Work",
          proposal.sections.scopeOfWork,
          "scopeOfWork"
        )}
        {renderSection(
          "Project-Specific Inclusions",
          proposal.sections.projectSpecificInclusions,
          "projectSpecificInclusions"
        )}
        {renderSection(
          "Project-Specific Exclusions",
          proposal.sections.projectSpecificExclusions,
          "projectSpecificExclusions"
        )}
        {renderSection(
          "Clarifications & Assumptions",
          proposal.sections.clarificationsAssumptions,
          "clarificationsAssumptions"
        )}
        {renderSection(
          "Commercial Terms",
          proposal.sections.commercialTerms,
          "commercialTerms"
        )}
        {renderSection(
          "Acceptance & Signature",
          proposal.sections.acceptanceSignature,
          "acceptanceSignature"
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-300 text-center text-xs text-gray-500">
        <p>{proposal.header.companyName}</p>
        <p className="mt-1">Page 1</p>
      </div>
    </div>
  );
}



