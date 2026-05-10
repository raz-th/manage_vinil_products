import ProdusManagement from "./Client";


export async function generateMetadata({ params }) {
    const { id } = await params;
    return {
        title: `Management Produs: ${id}`,
    };
}

const Page = async ({ params }) => {
    const { id } = await params;
    return <ProdusManagement id={id} />;
};

export default Page;