import os

# Global Hugging Face credentials for CLI commands
hf_credentials = {
    "hf_user": "",
    "hf_token": ""
}

def set_hf_credentials(user: str, token: str):
    """
    Set Hugging Face credentials globally
    """
    global hf_credentials
    hf_credentials["hf_user"] = user
    hf_credentials["hf_token"] = token
    
    # Set environment variables for the current process
    if user:
        os.environ['HF_USER'] = user
    if token:
        os.environ['HUGGINGFACE_TOKEN'] = token

def get_hf_env_for_cli():
    """
    Get Hugging Face environment variables for CLI commands
    Returns a dict that can be used to set environment variables in subprocess calls
    """
    env = {}
    if hf_credentials["hf_user"]:
        env['HF_USER'] = hf_credentials["hf_user"]
    if hf_credentials["hf_token"]:
        env['HUGGINGFACE_TOKEN'] = hf_credentials["hf_token"]
    return env

def get_hf_credentials():
    """
    Get current Hugging Face credentials
    """
    # Get from system environment first
    system_hf_user = os.environ.get('HF_USER', '')
    system_hf_token = os.environ.get('HUGGINGFACE_TOKEN', '')
    
    # Use stored credentials if system env is empty
    hf_user = system_hf_user or hf_credentials["hf_user"]
    hf_token = system_hf_token or hf_credentials["hf_token"]
    
    return {
        "hf_user": hf_user,
        "hf_token": hf_token,
        "has_user": bool(hf_user),
        "has_token": bool(hf_token),
        "source": "system" if system_hf_user or system_hf_token else "stored"
    } 