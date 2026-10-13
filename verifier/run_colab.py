#!/usr/bin/env python3
"""
Gridlock Standalone In-Pod Verifier Script
Can be executed directly in any Python environment with PyTorch or NumPy:
curl -sL https://raw.githubusercontent.com/devprashant19/Gridlock/main/verifier/run_colab.py | python3 - --api URL --delivery 1 --gpu-class T4
"""

import sys
import os
import argparse

# Add parent path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from verifier.cli.main import main

if __name__ == "__main__":
    main()
