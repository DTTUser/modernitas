---
title: Planning for change
order: 8
---

We have seen the miserable success rate of IT projects and one factor which contributes to this is poor change management. The latter link is an ISO document and is joined by a shorter view below.

- [Planning in a World of Change](https://www.datacenterdynamics.com/en/opinions/planning-in-a-world-of-change/)

<!-- full article -->

> *Objective:* To introduce the key discipline of change management, a key method of avoiding situations where the left hand does not know what the right is doing. Simply put, without it projects and maintenance tasks are on very shaky foundations.

Change management is the process of planning, implementing, and controlling change within an organisation to minimise negative impacts that impact business and to maximise the benefits of that change.

#### Examples of Its Absence
1.  It is by now history, but history has lessons for us all. A global IT failure wreaked havoc on Friday 19<sup>th</sup> July, 2024, grounding flights and disrupting everything from hospitals to government agencies. A security product update to the Azure cloud failed and bombed over 8 m. PCs and probably half the world’s industries.

2.  Another incident, recounted elsewhere in this course, involved an account I managed. One Monday morning, the normal power up of applications decided to stay asleep and this eventually resulted in IBM and other vendors carrying out hours of investigation. It turned out that the communications team had made a change to a comms table on the Sunday and told nobody about it.

Both these incidents, and almost certainly thousands of others elsewhere before and after, were due to poor or absent change management. It is important and not optional, hence this document.

#### What is It?
Organisations that can effectively manage change are more likely to succeed on account of fewer IT, and therefore business interruptions and thus higher productivity and, eventually, a better company bottom line. I suppose it could be called DA (disaster avoidance), a companion of DR (disaster recovery).

Change management can provide a company with a competitive advantage, helping to lower costs, avoid security exposures, facilitate audits, and minimise disruptions to key IT services and applications.

A change can involve any configuration item, part of IT infrastructure (new storage device), software updates (vendor of internal application) and other.

  - Application changes

  - Hardware changes

  - Software changes

  - Network changes

  - Environmental changes

  - Documentation changes

  - Personnel changes connected with this

One of the main reasons for change management is to assess the effect on any change on the rest of the whole system. Failure to do this can have catastrophic consequences; I have seen them when unauthorised changes are made to systems, especially involving software.

#### Change Requests
All changes should be tracked in a change management system. The change is documented in the change tracking system when the change initiator has completed the required level of technical verification and filed a change request.

The following status codes can be used to reflect the status of a change request:

  - Open: The change has been received and accepted but has not been assigned.

  - In-Progress: The change has been received, acknowledged, and assigned. Work is in progress to fulfil the change request.

  - Approved: The business and technical assessments have been completed and the change has been approved and committed to the change scheduler.

  - Rejected: The change has been rejected and will be routed back to the requester with an explanation and a recommended course of action.

  - Closed: The change request has been closed.

  - Cancelled: The change request has been cancelled.

In a nutshell, change management is vital in tracking and verifying changes and ensuring that relevant personnel are kept informed.

### Change/Configuration Management
We have seen early in this document that 'change' and operational 'volatility' can have an adverse effect on availability or, at least, predispose systems to fail.

Change management and configuration management are very close together in terms of what they seek to achieve. Change management seeks to make changes to resources in a system in a controlled and consistent manner while understanding the impact on other parts of the system.

### Change Management and Control: Best Practice
The basic elements of this key discipline are:
  - Identify a change management team (virtual, containing relevant skills) plus a change controller

  - Devise documentation and meetings plans (what, where and when)

  - Request for a change (initiation) from the business, IT, user or problem resolution

[This was not done in the two sad cases 1. and 2. described above]

  - Change impact analysis - will a change to system software X related to application A have an adverse effect on application B?

  - Authorisation for the change from an appropriate authority

  - Publish the impending change - to IT staff concerned and any users who might be affected. You don't need to tell everyone about every minor change though.

  - Scheduling and tracking the change(s) as a mini-project

  - Change installation, coordination and verification

  - Backout procedures for the change where the change causes other problems. This ability is vital to an installation making changes

  - If the change does not have the desired results, then a root cause analysis should be carried out to avoid repetition in the future

  - Change review, document and publish the results

  - Areas where change management is required include:

  - Operating environment patch management

  - Application patch/upgrade management

  - Concurrent upgrade of hardware or software

  - Installation of new hardware or software

  - Changing system or application parameters, for example, tuning the operating system or reorganising an application database

  - Other changes which might impact business services’ availability or correct functioning. A service which doesn’t deliver what it is supposed to deliver can be considered ‘*unavailable*’ without necessarily involving outages of hardware or software

  - As ever, update and maintain the change documentation. You never know when you might need it.

![](/assets/img/articles/planning-for-change-image1.png)

*Figure 1: Change Control Schematic Flow*
The shaded box **'backout change'** is a vital step in the change management process. If this cannot be done, or is very slow to complete, the service will remain in limbo until the *status quo* is restored. This will result in extra time added to any subsequent 'ramp up' time. In the case of a UK bank in 2013, the delay in complete restoration of all services ran into days and very large amounts of money in compensation.

If you cannot back it out, better have a system image or similar to replace the whole thing.

*Moral**:*** Backout and subsequent ramp up time after a failed change are critical factors in service uptime.

### Change Operations
This the job of the change team using the established, agreed and understood procedure for changes**:**

  - > The request for a change to be made is generated

  - > A change impact analysis is performed, especially clashes with other changes

  - > People concerned with other, related system factors are notified in case they are affected

  - > The change is authorised by IT and management of the requestor

  - > The change is scheduled and tracked

  - > the change is performed and verified

  - > the change is backed out if unsuccessful

  - > The requestor(s) are informed who provide change feedback

  - > The change is reviewed and documented

### Patch Management
A major factor in the volatility of a service is the application of patches to the various layers of software, including the operating system. This is a change management issue as assumes greater importance the more patches that need to be applied. There are at least three philosophies pertaining to patch management:

  - put them all on a.s.a.p.

  - only put on the patches that our system needs, if you are sure

  - don't bother with any of them - not recommended

The decision which route to take may be different for different types of patch. Hot fixes are usually offered to fix a specific problem which your organisation may or may not have. Other are a series of patches - rollups and service packs.

There are several papers on the topic which might be useful in deciding the patch philosophy your organisation should adopt in the HA environment. The second reference (from Cisco) contains other references, including the NIST documentation on patch management.

#### Use in RCA
The output of change management can be of vital importance in RCA (root cause analysis) inasmuch as it may give a clue to the possible cause from the sequence of events preceding the ‘outage'.

***Quote**: “There are people who make things happen, people who watch* *things happen and people who say ‘what happened*?' “. Which category are you?
