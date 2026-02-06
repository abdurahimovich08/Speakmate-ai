"""
SpeakMate AI - Run Script

Quick start script for development and production.
"""
import os
import sys
import argparse


def main():
    parser = argparse.ArgumentParser(description="Run SpeakMate AI Server")
    parser.add_argument(
        "--mode", 
        choices=["dev", "prod", "worker"],
        default="dev",
        help="Run mode"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Server port"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Number of workers (prod mode)"
    )
    
    args = parser.parse_args()
    
    if args.mode == "dev":
        # Development mode with hot reload
        import uvicorn
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=args.port,
            reload=True,
            log_level="debug"
        )
    
    elif args.mode == "prod":
        # Production mode with multiple workers
        import uvicorn
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=args.port,
            workers=args.workers,
            log_level="info"
        )
    
    elif args.mode == "worker":
        # Background worker mode
        print("Starting RQ worker...")
        os.system("rq worker high default low")


if __name__ == "__main__":
    main()
