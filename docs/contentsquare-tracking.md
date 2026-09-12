# Contentsquare tracking

Contentsquare is loaded only after Cookiebot statistics consent. Application
events use the `_uxa` queue so that they are delivered even when the tracking
script is still loading.

The event names are deliberately constant and contain no search terms, course
IDs, user IDs, names, email addresses, or other form values:

- `Page Viewed`
- `Campaign Landing Viewed`
- `Campaign CTA Clicked`
- `Search Results Viewed`
- `Course Detail Viewed`
- `Course Inquiry Submitted`
- `Newsletter Signup`
- `User Signup`

`Course Inquiry Submitted` is emitted only after `/api/send-lead` has returned
successfully. It is therefore the preferred Contentsquare conversion goal and
the final step of the visitor funnel.

Internal traffic must be excluded in Contentsquare through IP Blocking. Do not
hard-code staff IP addresses or user identifiers in the website bundle.
