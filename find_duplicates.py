#!/usr/bin/env python3
"""
Find duplicate images in the media folder using perceptual hashing.
"""
import os
import sys
from pathlib import Path
from collections import defaultdict

# Try to import imagehash, fall back to file hash if not available
try:
    from PIL import Image
    import imagehash
    USE_PERCEPTUAL = True
except ImportError:
    import hashlib
    USE_PERCEPTUAL = False
    print("Note: Using file hash (MD5) instead of perceptual hashing. Install imagehash for better detection.")

MEDIA_DIR = Path("/Users/raviclaw/.openclaw/workspace/nm-portfolio2/media")

def get_file_hash(filepath):
    """Get MD5 hash of file contents."""
    hash_md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_image_hash(filepath):
    """Get perceptual hash of image."""
    try:
        with Image.open(filepath) as img:
            # Use average hash for speed, phash for accuracy
            return str(imagehash.phash(img))
    except Exception as e:
        return None

def find_duplicates():
    """Find duplicate images in the media folder."""
    # Group by file size first (quick filter)
    size_groups = defaultdict(list)
    
    for filepath in MEDIA_DIR.iterdir():
        if filepath.is_file():
            try:
                size = filepath.stat().st_size
                size_groups[size].append(filepath)
            except Exception:
                pass
    
    # For groups with same size, check hashes
    duplicates = []
    checked = set()
    
    for size, files in size_groups.items():
        if len(files) < 2:
            continue
            
        # Get hashes for all files of same size
        hash_map = defaultdict(list)
        
        for filepath in files:
            if USE_PERCEPTUAL:
                file_hash = get_image_hash(filepath)
            else:
                file_hash = get_file_hash(filepath)
            
            if file_hash:
                hash_map[file_hash].append(filepath)
        
        # Find groups with same hash
        for file_hash, paths in hash_map.items():
            if len(paths) > 1:
                duplicates.append({
                    'hash': file_hash,
                    'files': [str(p.name) for p in paths]
                })
    
    return duplicates

if __name__ == "__main__":
    print("Scanning for duplicate images in media folder...")
    print(f"Using {'perceptual' if USE_PERCEPTUAL else 'file'} hashing")
    print("-" * 60)
    
    dups = find_duplicates()
    
    if not dups:
        print("No duplicates found!")
    else:
        print(f"\nFound {len(dups)} groups of duplicates:\n")
        for i, group in enumerate(dups, 1):
            print(f"Group {i} (hash: {group['hash'][:16]}...):")
            for f in group['files']:
                print(f"  - {f}")
            print()
