# Local Adaptation Checklist

Use this checklist before adapting PedsPath-CDS to a new site. Confirm each item with local stakeholders and document responses.

- [ ] Is there already a local bronchiolitis pathway?
- [ ] Who owns the pathway (service line / champion)?
- [ ] Is there an Epic order set? Name and version?
- [ ] What oxygen saturation threshold is accepted for admission/discharge?
- [ ] Is a respiratory scoring tool used? Which one?
- [ ] Who approves order set or SmartPhrase changes?
- [ ] Are residents allowed to access Reporting Workbench, SlicerDicer, Clarity, Caboodle?
- [ ] What data are available via FHIR endpoints today?
- [ ] What data require analyst or warehouse support?
- [ ] Is this project QI, research, or operational?
- [ ] Is IRB review required?
- [ ] What privacy, security, or governance review is needed?
- [ ] Is there already an active bronchiolitis QI project to align with?
- [ ] Stakeholder coverage confirmed (PHM, ED, RT, nursing, pharmacy, QI, informatics, Epic analysts)?
- [ ] Ops readiness: confirm LAN IP, unused ports, reverse proxy, and TLS approach (VPN/Tailscale/basic auth).
- [ ] Subpath hosting (if needed): set `VITE_BASE_PATH`, route `/peds/` to frontend and `/peds/api/` to backend.
