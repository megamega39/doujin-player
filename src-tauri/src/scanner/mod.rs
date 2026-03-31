//! ライブラリスキャン処理
//!
//! 作品フォルダの検出、サムネイル検出、音声バリエーション検出を行う

mod thumbnail;
mod work_detector;

pub use work_detector::*;
pub use thumbnail::*;
