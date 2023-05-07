# gatsby-remark-videos

The intent of this plugin is to aid in the embedding of looping 'html5 gifv'
like videos from markdown.

## Install

`npm install --save gatsby-remark-videos gatsby-plugin-ffmpeg`

This package is dependent on gatsby-plugin-ffmpeg which has the requirement of ffmpeg installed. Please follow the instructions at https://github.com/Mike-Dax/gatsby-plugin-ffmpeg to install the required dependencies.

## Usage

The order of the pipelines will influence the final order in the `<video />`
tag.

Currently it only detects files with the extensions `avi`, `mp4`, `mov`, `mkv`. If you have a different container and would like it added, open an issue or create a PR and I'm happy to include it.

### Configuration

Make sure this plugin comes before `gatsby-remark-images` otherwise it might complain about unknown image file formats.

```javascript
// In your gatsby-config.js
plugins: [
  ...
  {
    resolve: `gatsby-remark-videos`,
    options: {
      pipelines: [
        {
          name: 'vp9',
          transcode: chain =>
            chain
              .videoCodec('libvpx-vp9')
              .noAudio()
              .outputOptions(['-crf 20', '-b:v 0']),
          maxHeight: 480,
          maxWidth: 900,
          fileExtension: 'webm',
        },
        {
          name: 'h264',
          transcode: chain =>
            chain
              .videoCodec('libx264')
              .noAudio()
              .addOption('-profile:v', 'main')
              .addOption('-pix_fmt', 'yuv420p')
              .outputOptions(['-movflags faststart'])
              .videoBitrate('1000k'),
          maxHeight: 480,
          maxWidth: 900,
          fileExtension: 'mp4',
        },
      ],
    }
  },
  ...
]
```

Also make sure you have a plugin that copies the files you are referencing, for example `gatsby-remark-copy-linked-files`.

```
...
{
  resolve: `gatsby-remark-copy-linked-files`,
  options: {},
},
...
```

### Markdown Syntax

Markdown image syntax is used:

```
Video one:
![](video.avi)
```

Creates roughly this:

```html
<video autoplay loop>
  <source src="/static/video-hash-optshash.webm" type="video/webm" />
  <source src="/static/video-hash-optshash.mp4" type="video/mp4" />
</video>
```

## Funding

<p align="center">
<a href="https://electricui.com/">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://electricui.com/web_static/monochrome-logotype.svg">
  <img alt="Electric UI" src="https://electricui.com/web_static/logotype.svg" width="500">
</picture>
</a>
</p>

---

Work on `gatsby-plugin-ffmpeg` is funded by [Electric UI](https://electricui.com). If you need to design an [Arduino GUI](https://electricui.com/hello/arduino), want [visualisations for a complex robotics system](https://electricui.com/features) or generally need a [user interface for your hardware project](https://electricui.com/features), please take a look at the website.
