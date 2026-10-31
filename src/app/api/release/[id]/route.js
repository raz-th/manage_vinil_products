export async function GET(request, { params }) {
    const { id } = await params;

    const res = await fetch(`https://api.discogs.com/releases/${id}`, {
        headers: {
            Authorization: `Discogs token=${process.env.NEXT_PUBLIC_APP_DISCOGS_API_KEY}`,
            "User-Agent": "MyApp/1.0",
        }
    });

    const data = await res.json();
    return Response.json(data);
}