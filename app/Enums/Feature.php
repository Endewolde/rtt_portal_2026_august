<?php

namespace App\Enums;

enum Feature: string
{
    case Proposals = 'proposals';
    case Finance = 'finance';
    case Evaluation = 'evaluation';
    case Monitoring = 'monitoring';
    case Reports = 'reports';
    case Repository = 'repository';
    case Similarity = 'similarity';
    case Complaints = 'complaints';
    case ExternalFunds = 'external_funds';
    case Events = 'events';

    public function label(): string
    {
        return match ($this) {
            self::Proposals => 'Proposal Management',
            self::Finance => 'Budget & Finance',
            self::Evaluation => 'Peer Review & Evaluation',
            self::Monitoring => 'Research Monitoring',
            self::Reports => 'Analytics & Reports',
            self::Repository => 'Research Repository',
            self::Similarity => 'Plagiarism Detection',
            self::Complaints => 'Complaint Handling',
            self::ExternalFunds => 'External Funds',
            self::Events => 'Conferences & Events',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::Proposals => 'Submit, track, and manage research proposals through the full lifecycle',
            self::Finance => 'Budget requests, disbursements, allocations, and financial settlements',
            self::Evaluation => 'Blind peer review, central evaluation, and open defence sessions',
            self::Monitoring => 'Midterm evaluations and completion workshop tracking',
            self::Reports => 'Generate, filter, and export analytical reports',
            self::Repository => 'Research output repository and public knowledge base',
            self::Similarity => 'AI-powered similarity scoring and plagiarism detection',
            self::Complaints => 'Complaint submission, escalation, and resolution tracking',
            self::ExternalFunds => 'Manage external grants, funding agencies, applications, awards, budgets, and expenditures',
            self::Events => 'Conferences, abstract submissions, and event management',
        };
    }
}
