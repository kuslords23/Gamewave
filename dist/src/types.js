/**
 * KUS WORLD ENGINE — Core Type Definitions
 *
 * These types define the data structures for the entire film-to-world pipeline.
 * Written as JSDoc-annotated JS for native browser module support.
 */

/* eslint-disable no-unused-vars */

/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} VideoSource
 * @property {File} file
 * @property {string} name
 * @property {number} size
 * @property {string} type
 * @property {number} duration - seconds
 * @property {number} frameRate
 * @property {number} totalFrames
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {'ingest'|'extract_frames'|'analyze_scenes'|'detect_objects'|'track_characters'|'transcribe_audio'|'reconstruct_3d'|'build_world'|'spawn'} PipelineStageId
 */

/**
 * @typedef {Object} PipelineStage
 * @property {PipelineStageId} id
 * @property {string} name
 * @property {'pending'|'running'|'completed'|'failed'|'skipped'} status
 * @property {number} progress
 * @property {Date} [startedAt]
 * @property {Date} [completedAt]
 * @property {string} [error]
 * @property {number} weight
 */

/**
 * @typedef {Object} PipelineState
 * @property {VideoSource|null} videoSource
 * @property {PipelineStage[]} stages
 * @property {number} currentStageIndex
 * @property {number} overallProgress
 * @property {'idle'|'running'|'completed'|'failed'} status
 * @property {Object|null} world
 * @property {Date} createdAt
 */

/**
 * @typedef {Object} PlayableWorld
 * @property {string} id
 * @property {string} name
 * @property {Object} sceneGraph
 * @property {Array} characters
 * @property {Array} assets
 * @property {Array} dialogues
 * @property {Object} environment
 * @property {'generating'|'ready'|'playing'|'error'} status
 * @property {Date} createdAt
 */

/**
 * @typedef {Object} PlayerState
 * @property {Vec3} position
 * @property {Vec3} rotation
 * @property {number} speed
 * @property {number} sprintMultiplier
 * @property {boolean} grounded
 * @property {string} currentScene
 */

export default {};