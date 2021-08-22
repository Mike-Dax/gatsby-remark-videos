const select = require('unist-util-select')
import path from 'path'
import isRelativeUrl from 'is-relative-url'
import slash from 'slash'
import { transcode } from 'gatsby-plugin-ffmpeg'
import type { FfmpegCommand } from 'fluent-ffmpeg'
import { Node } from 'unist'
import { Node as GatsbyNode } from 'gatsby'

const allowedFiletypes = ['avi', 'mp4', 'mov', 'mkv']

const defaults = {
  pipelines: [
    {
      name: 'vp9',
      transcode: (chain: FfmpegCommand) =>
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
      transcode: (chain: FfmpegCommand) =>
        chain.videoCodec('libx264').noAudio(),
      maxHeight: 480,
      maxWidth: 900,
      fileExtension: 'mp4',
    },
  ],
}

interface PluginOptions {}

export default async function transform(
  {
    files,
    markdownNode,
    markdownAST,
    pathPrefix,
    getNode,
    reporter,
  }: {
    files: GatsbyNode[]
    markdownNode: any
    markdownAST: Node
    pathPrefix: string
    getNode: any
    reporter: any
  },
  pluginOptions: PluginOptions
) {
  const options = Object.assign({}, defaults, pluginOptions)

  // This will only work for markdown syntax image tags
  const markdownVideoNodes = select(markdownAST, `image`)

  // Takes a node and generates the needed videos and then returns
  // the needed HTML replacement for the video
  const generateVideosAndUpdateNode = async function (node: any) {
    // Check if this markdownNode has a File parent. This plugin
    // won't work if the video isn't hosted locally.
    const parentNode = getNode(markdownNode.parent)
    let videoPath: string
    if (parentNode && parentNode.dir) {
      videoPath = slash(path.join(parentNode.dir, node.url))
    } else {
      return null
    }

    const videoNode = files.find((file) => {
      if (file && file.absolutePath) {
        return file.absolutePath === videoPath
      }
      return null
    })

    if (!videoNode || !videoNode.absolutePath) {
      return null
    }

    let transcodeResult = await transcode({
      file: videoNode as any,
      options,
      reporter,
    })

    // Calculate the paddingBottom %
    const sourceTags = transcodeResult.videos.map((video) => {
      return `<source src="${video.src}" type="video/${video.fileExtension}">`
    })

    /*
    console.log(
      transcodeResult.presentationMaxWidth,
      transcodeResult.presentationMaxHeight
    );
    */

    let wrapperAspectStyle
    let videoAspectStyle

    if (transcodeResult.aspectRatio < 1) {
      wrapperAspectStyle = `max-width: ${transcodeResult.presentationMaxWidth}px; max-height: ${transcodeResult.presentationMaxHeight}px; margin-left: auto; margin-right: auto;`
      videoAspectStyle = `height: 100%; width: 100%; margin: 0 auto; display: block; max-height: ${transcodeResult.presentationMaxHeight}px;`
    } else {
      // we're landscape, use the video aspect ratio to create a

      const ratio = `${(1 / transcodeResult.aspectRatio) * 100}%`

      wrapperAspectStyle = `position: relative; display: block; padding-top: ${ratio};`
      videoAspectStyle = `position: absolute; top: 0; left: 0; width: 100%; height: auto;`
    }

    const videoTag = `
    <video preload autoplay muted loop playsinline style="${videoAspectStyle}">
      ${sourceTags.join('')}
    </video>
    `

    let rawHTML = `
      <div
      class="gatsby-video-aspect-ratio"
      style="${wrapperAspectStyle}"
      >${videoTag}</div>
    `

    return rawHTML
  }

  await Promise.all(
    markdownVideoNodes.map(async (node: any) => {
      const fileType = node.url.split('.').pop()

      if (isRelativeUrl(node.url) && allowedFiletypes.includes(fileType)) {
        const rawHTML = await generateVideosAndUpdateNode(node)

        if (rawHTML) {
          // Replace the video node with an inline HTML node.
          node.type = `html`
          node.value = rawHTML
        }

        return node
      } else {
        // Video isn't relative so there's nothing for us to do.
        return null
      }
    })
  )
}
