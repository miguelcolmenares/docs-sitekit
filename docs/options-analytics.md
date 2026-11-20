# Options: analytics

One key, `analytics`, loads Google Tag Manager or Google Analytics 4 on every page of the site. Without the key, the site has no script, no request and no cookie from analytics, so a site that does not set it is the same as before.

The keys are documented in the configuration reference, under [`analytics`](./configuration.md#analytics). This page shows them in use and says what they write into the pages.

## Google Tag Manager

```json title="sitekit.config.json"
{
  "analytics": {
    "provider": "gtm",
    "id": "GTM-XXXXXXX"
  }
}
```

With `gtm`, every page gets the head script of Google Tag Manager, and the first thing in `<body>` is the `noscript` frame that Google gives for a visitor without JavaScript. The container loads the tags you set up in Tag Manager, so the kit does not know which tags there are.

## Google Analytics 4

```json title="sitekit.config.json"
{
  "analytics": {
    "provider": "ga4",
    "id": "G-XXXXXXXXXX"
  }
}
```

With `ga4`, every page gets the gtag.js snippet of Google Analytics 4 in the head: the script that loads the library, and the two calls that start it with your measurement ID. The page does not get the Tag Manager snippet, and a site has one provider, not both.

## The ID

The `id` must start with the prefix of its provider, and the build stops with a message when it does not:

- `gtm` takes a container ID that starts with `GTM-`, such as `GTM-XXXXXXX`.
- `ga4` takes a measurement ID that starts with `G-`, such as `G-XXXXXXXXXX`.

A `GTM-` ID under `ga4`, or a `G-` ID under `gtm`, fails the build and `sitekit check` with the prefix it needs. The ID is a public value that the page shows to every visitor, so it is safe to commit.

## What the kit does not do

- **No consent.** The kit does not ask the visitor before it loads the script, and it does not wait for a choice. If your visitors need a notice or a choice before analytics runs, the site owner writes it. The kit writes no cookie of its own, but Google's tag may set cookies in the visitor's browser, as it does on any site that loads it.
- **No events.** The snippets only load the provider. A click, a search or a form is not reported unless you add the tags in the provider's own console.
- **No check of the account.** The kit reads the ID as text. It does not know whether the container or the property exists.
